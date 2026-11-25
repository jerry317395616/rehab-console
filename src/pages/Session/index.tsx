import { PageContainer, ProDescriptions } from '@ant-design/pro-components';
import { useModel } from '@umijs/max';
import React from 'react';

export default function Session() {
  const { initialState } = useModel('@@initialState');
  const user = initialState?.currentUser;
  return (
    <PageContainer title="当前账号">
      <ProDescriptions
        title="账号信息"
        column={1}
        dataSource={user}
        columns={[
          { title: '姓名', dataIndex: 'name' },
          { title: '账号', dataIndex: 'userid' },
          { title: '邮箱', dataIndex: 'email' },
          {
            title: '角色',
            dataIndex: 'roles',
            render: () => user?.roles.join('、'),
          },
          { title: '站点', dataIndex: 'site' },
        ]}
      />
    </PageContainer>
  );
}
