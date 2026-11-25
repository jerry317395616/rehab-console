import { Alert, Button, Empty, Flex, Tag, Typography, theme } from 'antd';
import type { Booking, Day, Slot } from './service';
import { clock, slotKey, statuses } from './service';

const step = 15;
const height = 32;

function minute(time: string) {
  return Number(time.slice(11, 13)) * 60 + Number(time.slice(14, 16));
}

export default function TherapistDay({
  day,
  verified,
  selected,
  choosing,
  canBook,
  onCandidate,
  onSelect,
  onDetail,
}: {
  day: Day;
  verified: Slot[];
  selected?: Slot;
  choosing: boolean;
  canBook: boolean;
  onCandidate: (therapist: string, at: string, label: string) => void;
  onSelect: (slot: Slot) => void;
  onDetail: (record: Booking) => void;
}) {
  const { token } = theme.useToken();
  if (!day.rows.length)
    return <Empty description="当天没有可显示的排班或预约" />;
  const start = Math.floor(day.start_minute / step) * step;
  const end = Math.ceil(day.end_minute / step) * step;
  const intervals = Array.from(
    { length: (end - start) / step },
    (_, index) => start + index * step,
  );
  const top = (value: number) => ((value - start) / step) * height;
  const now = day.date === day.today && day.now ? minute(day.now) : 0;
  const border = `1px solid ${token.colorBorderSecondary}`;
  return (
    <Flex vertical gap={12}>
      <Flex wrap gap={8} align="center">
        <Tag color="processing">预约</Tag>
        <Tag>已占用</Tag>
        <Tag>未排班</Tag>
        <Tag color="success">医嘱已核验时段</Tag>
        <Typography.Text type="secondary">时区 {day.timezone}</Typography.Text>
      </Flex>
      {!day.shifts_available && (
        <Alert
          type="info"
          showIcon
          title="当前账号未获授权核对班次，日程显示可读取的预约。"
        />
      )}
      <div
        style={{
          overflow: 'auto',
          maxHeight: '68vh',
          border,
          borderRadius: token.borderRadius,
        }}
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: `86px repeat(${day.rows.length}, minmax(150px, 1fr))`,
            minWidth: 86 + day.rows.length * 150,
          }}
        >
          <div
            style={{
              background: token.colorFillAlter,
              padding: 12,
              borderBottom: border,
            }}
          >
            时段
          </div>
          {day.rows.map((row) => (
            <div
              key={row.key}
              style={{
                padding: 12,
                borderLeft: border,
                borderBottom: border,
                background: token.colorFillAlter,
              }}
            >
              <Typography.Text strong>{row.label}</Typography.Text>
            </div>
          ))}
          <div style={{ background: token.colorBgContainer }}>
            {intervals.map((value) => (
              <div
                key={value}
                style={{ height, padding: '4px 12px', borderBottom: border }}
              >
                <Typography.Text type="secondary">
                  {clock(value)}
                </Typography.Text>
              </div>
            ))}
          </div>
          {day.rows.map((row) => (
            <div
              key={row.key}
              style={{ position: 'relative', borderLeft: border }}
            >
              {intervals.map((value) => {
                const choices = verified.filter(
                  (slot) =>
                    slot.assigned_to === row.key &&
                    minute(slot.starts_at) >= value &&
                    minute(slot.starts_at) < value + step,
                );
                const shift = row.shifts.find(
                  (segment) =>
                    segment.start_minute < value + step &&
                    segment.end_minute > value,
                );
                const candidate = Math.max(value, shift?.start_minute ?? value);
                const occupied = row.events.some(
                  (event) =>
                    event.start_minute <= candidate &&
                    event.end_minute > candidate,
                );
                const available =
                  canBook &&
                  day.date >= day.today &&
                  row.key !== '__unassigned__';
                const begin =
                  available &&
                  !choosing &&
                  !occupied &&
                  candidate >= now &&
                  (shift || !day.shifts_available);
                return (
                  <div
                    key={value}
                    style={{
                      display: 'grid',
                      placeItems: 'center',
                      height,
                      borderBottom: border,
                      background: choices.length
                        ? token.colorSuccessBg
                        : shift || !day.shifts_available
                          ? token.colorBgContainer
                          : token.colorFillQuaternary,
                    }}
                  >
                    {available &&
                      choices.map((slot) => {
                        const active = Boolean(
                          selected && slotKey(slot) === slotKey(selected),
                        );
                        return (
                          <Button
                            key={slotKey(slot)}
                            size="small"
                            color="green"
                            variant={active ? 'solid' : 'text'}
                            aria-pressed={active}
                            onClick={() => onSelect(slot)}
                            style={{ zIndex: 1 }}
                          >
                            {slot.starts_at.slice(11, 16)} 可约
                          </Button>
                        );
                      })}
                    {begin && !choices.length && (
                      <Button
                        type="text"
                        size="small"
                        aria-label={`${row.label} ${clock(candidate)} 预约`}
                        onClick={() =>
                          onCandidate(
                            row.key,
                            `${day.date} ${clock(candidate)}:00`,
                            row.label,
                          )
                        }
                        style={{ zIndex: 1 }}
                      >
                        预约
                      </Button>
                    )}
                  </div>
                );
              })}
              {row.events.map((event, index) => {
                const label = event.busy
                  ? '已占用'
                  : `${event.patient_name} · ${event.therapy_type}`;
                const color = event.busy
                  ? token.colorFillSecondary
                  : token.colorPrimaryBg;
                const status =
                  !event.busy &&
                  statuses[event.status as keyof typeof statuses]?.text;
                return (
                  <div
                    key={event.busy ? `busy-${index}` : event.name}
                    style={{
                      position: 'absolute',
                      top: top(event.start_minute),
                      height: Math.max(
                        3,
                        top(event.end_minute) - top(event.start_minute),
                      ),
                      width: `${100 / row.lanes}%`,
                      left: `${(100 * event.lane) / row.lanes}%`,
                      padding: 1,
                    }}
                  >
                    {event.busy ? (
                      <div
                        style={{
                          background: color,
                          height: '100%',
                          borderRadius: token.borderRadiusSM,
                          overflow: 'hidden',
                          paddingInline: 6,
                        }}
                      >
                        <Typography.Text type="secondary">
                          {label}
                        </Typography.Text>
                      </div>
                    ) : (
                      <Button
                        type="text"
                        block
                        onClick={() => onDetail(event)}
                        title={`${event.starts_at.slice(11, 16)}–${event.ends_at.slice(11, 16)} ${label} · ${event.room_label || '—'} · ${status || ''}`}
                        style={{
                          background: color,
                          height: '100%',
                          textAlign: 'left',
                          overflow: 'hidden',
                          paddingInline: 6,
                          display: 'block',
                        }}
                      >
                        <Typography.Text ellipsis>{label}</Typography.Text>
                        {event.end_minute - event.start_minute >= 30 && (
                          <div>
                            <Typography.Text type="secondary" ellipsis>
                              {event.room_label || status}
                            </Typography.Text>
                          </div>
                        )}
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </Flex>
  );
}
