// Publish the permission-aware desktop and account page. Starter examples stay in source.
export default [
  { path: '/user/login', layout: false, component: './user/login' },
  { path: '/apps', name: '应用', component: './Apps' },
  { path: '/apps/:appName', layout: false, component: './Application' },
  {
    path: '/apps/:appName/:moduleName',
    layout: false,
    component: './Application',
  },
  {
    path: '/apps/:appName/:moduleName/:itemId',
    layout: false,
    component: './Application',
  },
  { path: '/session', component: './Session' },
  { path: '/', redirect: '/apps' },
  { path: '*', component: './exception/404' },
];
