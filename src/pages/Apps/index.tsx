import { AppstoreOutlined } from '@ant-design/icons';
import { PageContainer } from '@ant-design/pro-components';
import { Link, useModel } from '@umijs/max';
import { Avatar, Button, Card, Empty, Grid, Result } from 'antd';
import { createStyles } from 'antd-style';
import React, { useEffect, useState } from 'react';
import DesktopSearch from '@/components/DesktopSearch';
import {
  applicationRoute,
  type DesktopApp,
  filterApplications,
  getApplications,
  safeApplicationPath,
} from '@/services/rehab/apps';
import { statusOf } from '@/services/rehab/auth';

const useStyles = createStyles(() => ({
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 260px), 1fr))',
    gap: 16,
    listStyle: 'none',
    margin: 0,
    padding: 0,
  },
  link: { display: 'block' },
}));

function Applications({ userId }: { userId: string }) {
  const { query, setQuery } = useModel('desktop');
  const { styles } = useStyles();
  const screens = Grid.useBreakpoint();
  const [apps, setApps] = useState<DesktopApp[]>([]);
  const [loading, setLoading] = useState(true);
  const [failure, setFailure] = useState<'403' | '500'>();
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    setQuery('');
  }, [userId, setQuery]);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setFailure(undefined);
    getApplications()
      .then((data) => {
        if (active) setApps(data);
      })
      .catch((error) => {
        if (!active) return;
        if (statusOf(error) === 401)
          window.dispatchEvent(new Event('rehab:session-expired'));
        else setFailure(statusOf(error) === 403 ? '403' : '500');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [attempt]);

  const visible = filterApplications(apps, query);
  return (
    <PageContainer
      title="应用"
      subTitle={loading || failure ? undefined : `${apps.length} 个可用应用`}
      breadcrumbRender={false}
      content={!screens.md ? <DesktopSearch placement="content" /> : undefined}
      loading={
        loading ? { spinning: true, description: '正在读取可用应用' } : false
      }
    >
      {!loading &&
        (failure ? (
          <Result
            status={failure}
            title={
              failure === '403'
                ? '当前账号无法读取应用列表'
                : '暂时无法读取应用列表'
            }
            subTitle={
              failure === '403'
                ? '请联系管理员核对应用授权。'
                : '请检查网络后重试。'
            }
            extra={
              <Button
                type="primary"
                onClick={() => setAttempt((value) => value + 1)}
              >
                重试
              </Button>
            }
          />
        ) : !visible.length ? (
          <Empty
            description={
              apps.length
                ? '没有匹配的应用'
                : '当前账号暂无可用应用，请联系管理员。'
            }
          />
        ) : (
          <ul className={styles.grid} aria-label="可用应用">
            {visible.map((app) => {
              const route = applicationRoute(app.name);
              const logo = safeApplicationPath(app.logo);
              const card = (
                <Card hoverable={Boolean(route)}>
                  <Card.Meta
                    avatar={
                      <Avatar
                        shape="square"
                        size={48}
                        src={logo}
                        icon={<AppstoreOutlined />}
                      />
                    }
                    title={app.title || app.name}
                    description={route ? undefined : '应用标识无效'}
                  />
                </Card>
              );
              return (
                <li key={`${app.name}:${app.route || ''}`}>
                  {route ? (
                    <Link
                      className={styles.link}
                      to={route}
                      aria-label={`打开${app.title || app.name}`}
                    >
                      {card}
                    </Link>
                  ) : (
                    card
                  )}
                </li>
              );
            })}
          </ul>
        ))}
    </PageContainer>
  );
}

export default function ApplicationDesktop() {
  const { initialState } = useModel('@@initialState');
  const userId = initialState?.currentUser?.userid || '';
  if (!userId) return null;
  return <Applications key={userId} userId={userId} />;
}
