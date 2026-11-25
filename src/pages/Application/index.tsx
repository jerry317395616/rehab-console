import { AppstoreOutlined, UserOutlined } from '@ant-design/icons';
import { PageContainer, ProLayout } from '@ant-design/pro-components';
import { history, useLocation, useModel, useParams } from '@umijs/max';
import { Avatar, Button, Card, Empty, Grid, Result } from 'antd';
import React, { useEffect, useState } from 'react';
import { AvatarDropdown } from '@/components/RightContent/AvatarDropdown';
import {
  type ApplicationContext,
  getApplication,
  menuItemRoute,
  moduleRoute,
  navigationRoute,
  safeApplicationPath,
} from '@/services/rehab/apps';
import { type RehabUser, statusOf } from '@/services/rehab/auth';
import { localRoute } from '@/services/rehab/session';
import defaultSettings from '../../../config/defaultSettings';
import ApplicationNavigation from './ApplicationNavigation';
import ChargeCatalog from './ChargeCatalog';
import ChargeInvoice from './ChargeCatalog/ChargeInvoice';
import OrderCatalog from './ChargeCatalog/OrderCatalog';
import SchemeList from './ChargeCatalog/SchemeList';
import CompanyList from './CompanyList';
import DepartmentList from './DepartmentList';
import DoctorWorkstation from './DoctorWorkstation';
import EmployeeList from './EmployeeList';
import EquipmentCatalog from './EquipmentCatalog';
import InspectionPlans from './EquipmentCatalog/InspectionPlans';
import InspectionRecords from './EquipmentCatalog/InspectionRecords';
import EquipmentTypeList from './EquipmentCatalog/TypeList';
import MedicalDepartments from './MedicalDepartments';
import MedicalStaff from './MedicalStaff';
import MedicalTemplates from './MedicalTemplates';
import CategoryDirectory from './MedicalTemplates/CategoryDirectory';
import { navigationEntries, selectedEntry } from './navigation';
import PatientRegistration from './PatientRegistration';
import PatientVisits from './PatientVisits';
import RoleList from './RoleList';
import RosterPlans from './RosterPlans';
import RosterSlots from './RosterSlots';
import ScaleBank from './ScaleBank';
import StaffProjects from './StaffProjects';
import TherapistWorkstation from './TherapistWorkstation';
import TherapyCatalog from './TherapyCatalog';
import TherapyTeams from './TherapyTeams';
import TreatmentBooking from './TreatmentBooking';
import TreatmentDispatch from './TreatmentDispatch';
import TreatmentResources from './TreatmentResources';
import UserList from './UserList';

function Application({ appName, user }: { appName: string; user: RehabUser }) {
  const { moduleName, itemId } = useParams<{
    moduleName?: string;
    itemId?: string;
  }>();
  const location = useLocation();
  const screens = Grid.useBreakpoint();
  const nodeKey = new URLSearchParams(location.search).get('node');
  const [data, setData] = useState<ApplicationContext>();
  const [loading, setLoading] = useState(true);
  const [failure, setFailure] = useState<'403' | '500'>();
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const refresh = () => setAttempt((value) => value + 1);
    window.addEventListener('rehab:permissions-updated', refresh);
    return () =>
      window.removeEventListener('rehab:permissions-updated', refresh);
  }, []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setData(undefined);
    setFailure(undefined);
    getApplication(appName)
      .then((result) => {
        if (active) setData(result);
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
  }, [appName, attempt]);

  useEffect(() => {
    if (!data?.supported || itemId) return;
    const module = moduleName
      ? data.modules.find((module) => module.name === moduleName)
      : data.modules[0];
    const firstItem = module ? navigationEntries(module)[0]?.item : undefined;
    if (module && firstItem)
      history.replace(navigationRoute(appName, module.name, firstItem));
  }, [data, appName, moduleName, itemId]);

  const selected = data?.modules.find((module) => module.name === moduleName);
  const selectedItem = selected?.items?.find((item) => item.id === itemId);
  const selectedNavigation = selectedEntry(selected, itemId, nodeKey);
  const deniedModule = Boolean(moduleName && data && !selected);
  const deniedItem = Boolean(itemId && selected && !selectedItem);
  const routeFor = (target: string): string | undefined => {
    for (const module of data?.modules || []) {
      const item = module.items.find((entry) => entry.target?.name === target);
      if (item) return menuItemRoute(appName, module.name, item.id);
    }
    return undefined;
  };
  const pageTitle =
    selectedItem?.title || selected?.title || data?.app.title || '应用';
  const back = (
    <Button
      aria-label="返回应用桌面"
      title="返回应用桌面"
      icon={<AppstoreOutlined />}
      onClick={() => history.push('/apps')}
    >
      {screens.md ? '返回应用桌面' : null}
    </Button>
  );
  // ProLayout retains measured action width; reset it when the header changes shape.
  return (
    <ProLayout
      key={screens.md ? 'desktop' : 'mobile'}
      {...defaultSettings}
      title={data?.app.title || '应用'}
      logo={safeApplicationPath(data?.app.logo) || defaultSettings.logo}
      layout="mix"
      splitMenus={false}
      menu={{ locale: false, defaultOpenAll: false }}
      menuRender={data?.modules.length ? undefined : false}
      location={{ pathname: localRoute(location.pathname) }}
      route={{
        routes: (data?.modules || []).map((module) => ({
          path: moduleRoute(appName, module.name),
          name: module.title,
        })),
      }}
      menuContentRender={(props) => (
        <ApplicationNavigation
          modules={data?.modules || []}
          appName={appName}
          userId={user.userid}
          moduleName={moduleName}
          itemId={itemId}
          nodeKey={nodeKey}
          collapsed={Boolean(props.collapsed && !props.isMobile)}
          onNavigate={() => {
            if (props.isMobile) props.onCollapse?.(true);
          }}
        />
      )}
      onMenuHeaderClick={() => history.push('/apps')}
      actionsRender={() => [
        <React.Fragment key="apps">{back}</React.Fragment>,
        !screens.md ? (
          <AvatarDropdown key="account">
            <Button
              type="text"
              aria-label="账号菜单"
              title="账号菜单"
              icon={
                <Avatar size={24} src={user.avatar} icon={<UserOutlined />} />
              }
            />
          </AvatarDropdown>
        ) : null,
      ]}
      avatarProps={
        screens.md
          ? {
              src: user.avatar,
              icon: <UserOutlined />,
              title: user.name,
              render: (_, dom) => <AvatarDropdown>{dom}</AvatarDropdown>,
            }
          : false
      }
      pageTitleRender={() => `${pageTitle} - 工作台`}
      style={{ minHeight: '100vh' }}
    >
      <PageContainer
        title={<h1 style={{ margin: 0, font: 'inherit' }}>{pageTitle}</h1>}
        subTitle={
          selectedItem
            ? [
                selected?.title,
                ...(selectedNavigation?.parents.map((parent) => parent.title) ||
                  []),
              ].join(' / ')
            : undefined
        }
        breadcrumbRender={false}
        loading={
          loading ? { spinning: true, description: '正在读取应用模块' } : false
        }
      >
        {!loading &&
          (failure || deniedModule || deniedItem ? (
            <Result
              status={failure || '403'}
              title={
                failure === '500'
                  ? '暂时无法读取应用模块'
                  : deniedModule
                    ? '当前账号无法访问该模块'
                    : deniedItem
                      ? '当前账号无法访问该菜单'
                      : '当前账号无法访问该应用'
              }
              subTitle={
                failure === '500'
                  ? '请检查网络后重试。'
                  : '请联系管理员核对授权。'
              }
              extra={
                failure === '500' ? (
                  <Button
                    type="primary"
                    onClick={() => setAttempt((value) => value + 1)}
                  >
                    重试
                  </Button>
                ) : (
                  back
                )
              }
            />
          ) : appName === 'rehab' &&
            selectedItem?.target?.type === 'DocType' &&
            selectedItem.target.name === 'Sales Invoice' ? (
            <ChargeInvoice key={selectedItem.id} />
          ) : selectedItem?.target?.type === 'Report' &&
            selectedItem.target.name === 'Rehab Doctor Workstation' ? (
            <DoctorWorkstation key={`${appName}:${selectedItem.id}`} />
          ) : appName === 'rehab' &&
            selectedItem?.target?.type === 'Page' &&
            selectedItem.target.name === 'rehab-assessment-library' ? (
            <ScaleBank key={`${appName}:${selectedItem.id}`} />
          ) : appName === 'rehab' &&
            selectedItem?.target?.type === 'Page' &&
            selectedItem.target.name === 'rehab-medical-templates' ? (
            <MedicalTemplates key={`${appName}:${selectedItem.id}`} />
          ) : appName === 'rehab' &&
            selectedItem?.target?.type === 'Page' &&
            selectedItem.target.name === 'rehab-medical-template-categories' ? (
            <CategoryDirectory key={`${appName}:${selectedItem.id}`} />
          ) : (selectedItem?.target?.type === 'Report' &&
              selectedItem.target.name === 'Rehab Equipment Catalog') ||
            (selectedItem?.target?.type === 'Page' &&
              selectedItem.target.name === 'rehab-equipment') ? (
            <EquipmentCatalog key={`${appName}:${selectedItem.id}`} />
          ) : selectedItem?.target?.type === 'DocType' &&
            selectedItem.target.name === 'Rehab Equipment Type' ? (
            <EquipmentTypeList key={`${appName}:${selectedItem.id}`} />
          ) : selectedItem?.target?.type === 'DocType' &&
            selectedItem.target.name === 'Rehab Equipment Plan' ? (
            <InspectionPlans key={`${appName}:${selectedItem.id}`} />
          ) : selectedItem?.target?.type === 'DocType' &&
            selectedItem.target.name === 'Rehab Equipment Inspection' ? (
            <InspectionRecords key={`${appName}:${selectedItem.id}`} />
          ) : selectedItem?.target?.type === 'Report' &&
            selectedItem.target.name === 'Rehab Charge Catalog' ? (
            <ChargeCatalog key={`${appName}:${selectedItem.id}`} />
          ) : (selectedItem?.target?.type === 'Report' &&
              selectedItem.target.name === 'Rehab Patient Visits') ||
            (selectedItem?.target?.type === 'DocType' &&
              ['Patient Encounter', 'Inpatient Record'].includes(
                selectedItem.target.name,
              )) ? (
            <PatientVisits
              key={`${appName}:${selectedItem.id}`}
              initialKind={
                selectedItem.target.name === 'Inpatient Record'
                  ? 'inpatient'
                  : 'all'
              }
            />
          ) : (selectedItem?.target?.type === 'DocType' &&
              selectedItem.target.name === 'Patient') ||
            (selectedItem?.target?.type === 'Report' &&
              selectedItem.target.name === 'Rehab Patient Registration') ? (
            <PatientRegistration key={`${appName}:${selectedItem.id}`} />
          ) : selectedItem?.target?.type === 'DocType' &&
            selectedItem.target.name === 'Rehab Team Dispatch Item' ? (
            <TreatmentDispatch
              key={`${appName}:${selectedItem.id}`}
              bookingRoute={routeFor('Rehab Treatment Task')}
            />
          ) : appName === 'rehab' &&
            selectedItem?.target?.type === 'DocType' &&
            selectedItem.target.name === 'Rehab Treatment Task' ? (
            <TreatmentBooking
              key={`${appName}:${selectedItem.id}:${location.search}`}
              workstationRoute={routeFor('rehab-treatment-workstation')}
              initialOrder={
                new URLSearchParams(location.search).get('order') || undefined
              }
              initialDate={
                new URLSearchParams(location.search).get('date') || undefined
              }
            />
          ) : appName === 'rehab' &&
            selectedItem?.target?.type === 'Page' &&
            selectedItem.target.name === 'rehab-treatment-workstation' ? (
            <TherapistWorkstation
              key={`${appName}:${selectedItem.id}:${location.search}`}
              initialTask={
                new URLSearchParams(location.search).get('task') || undefined
              }
              initialDate={
                new URLSearchParams(location.search).get('date') || undefined
              }
            />
          ) : appName === 'rehab' &&
            selectedItem?.target?.type === 'DocType' &&
            selectedItem.target.name === 'Rehab Resource' ? (
            <TreatmentResources key={`${appName}:${selectedItem.id}`} />
          ) : selectedItem?.target?.type === 'DocType' &&
            selectedItem.target.name === 'Rehab Staff Roster Slot' ? (
            <RosterSlots key={`${appName}:${selectedItem.id}`} />
          ) : selectedItem?.target?.type === 'DocType' &&
            selectedItem.target.name === 'Rehab Staff Roster Plan' ? (
            <RosterPlans key={`${appName}:${selectedItem.id}`} />
          ) : selectedItem?.target?.type === 'DocType' &&
            selectedItem.target.name === 'Rehab Therapy Team' ? (
            <TherapyTeams key={`${appName}:${selectedItem.id}`} />
          ) : selectedItem?.target?.type === 'DocType' &&
            selectedItem.target.name === 'Rehab Staff Project Scope' ? (
            <StaffProjects key={`${appName}:${selectedItem.id}`} />
          ) : selectedItem?.target?.type === 'DocType' &&
            selectedItem.target.name === 'Therapy Type' ? (
            <TherapyCatalog key={`${appName}:${selectedItem.id}`} />
          ) : selectedItem?.target?.type === 'DocType' &&
            selectedItem.target.name === 'Rehab Order Item' ? (
            <OrderCatalog key={`${appName}:${selectedItem.id}`} />
          ) : selectedItem?.target?.type === 'DocType' &&
            selectedItem.target.name === 'Rehab Charge Scheme' ? (
            <SchemeList key={`${appName}:${selectedItem.id}`} />
          ) : selectedItem?.target?.type === 'DocType' &&
            selectedItem.target.name === 'User' ? (
            <UserList key={`${appName}:${selectedItem.id}`} />
          ) : selectedItem?.target?.type === 'DocType' &&
            selectedItem.target.name === 'Role' ? (
            <RoleList key={`${appName}:${selectedItem.id}`} />
          ) : selectedItem?.target?.type === 'DocType' &&
            selectedItem.target.name === 'Company' ? (
            <CompanyList key={`${appName}:${selectedItem.id}`} />
          ) : selectedItem?.target?.type === 'DocType' &&
            selectedItem.target.name === 'I-ONE Employee Directory' ? (
            <EmployeeList
              key={`${appName}:${selectedItem.id}`}
              userRoute={routeFor('User')}
              practitionerRoute={routeFor('Healthcare Practitioner')}
            />
          ) : selectedItem?.target?.type === 'DocType' &&
            selectedItem.target.name === 'Healthcare Practitioner' ? (
            <MedicalStaff
              key={`${appName}:${selectedItem.id}`}
              links={Object.fromEntries(
                (data?.modules ?? []).flatMap((module) =>
                  module.items.flatMap((item) =>
                    [
                      'Rehab Staff Project Scope',
                      'Rehab Therapy Team',
                      'Rehab Staff Roster Plan',
                      'Rehab Staff Roster Slot',
                    ].includes(item.target?.name || '')
                      ? [
                          [
                            item.title,
                            menuItemRoute(appName, module.name, item.id),
                          ],
                        ]
                      : [],
                  ),
                ),
              )}
            />
          ) : selectedItem?.target?.type === 'DocType' &&
            selectedItem.target.name === 'Medical Department' ? (
            <MedicalDepartments key={`${appName}:${selectedItem.id}`} />
          ) : selectedItem?.target?.type === 'DocType' &&
            selectedItem.target.name === 'Department' ? (
            <DepartmentList key={`${appName}:${selectedItem.id}`} />
          ) : (
            <Card>
              <Empty
                description={
                  !data?.supported
                    ? '该应用的新前端暂未开发'
                    : !data.modules.length
                      ? '当前账号没有可用模块，请联系管理员。'
                      : selectedItem
                        ? '菜单内容暂未开发'
                        : '当前模块暂无可用菜单'
                }
              />
            </Card>
          ))}
      </PageContainer>
    </ProLayout>
  );
}

export default function ApplicationPage() {
  const { appName = '' } = useParams<{ appName: string }>();
  const { initialState } = useModel('@@initialState');
  const user = initialState?.currentUser;
  if (!user) return null;
  return (
    <Application
      key={`${user.userid}:${appName}`}
      appName={appName}
      user={user}
    />
  );
}
