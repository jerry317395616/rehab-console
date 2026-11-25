/**
 * @name 代理的配置
 * @see 在生产环境 代理是无法生效的，所以这里没有生产环境的配置
 * -------------------------------
 * The agent cannot take effect in the production environment
 * so there is no configuration of the production environment
 * For details, please see
 * https://pro.ant.design/docs/deploy
 *
 * @doc https://umijs.org/docs/guides/proxy
 */
const backend = {
  target: process.env.REHAB_API_TARGET || 'http://127.0.0.1:8001',
  changeOrigin: true,
  cookieDomainRewrite: '',
  cookiePathRewrite: '/',
  // Only the local HTTP development proxy rewrites Secure cookies.
  onProxyRes(response: { headers: { 'set-cookie'?: string[] } }) {
    const cookies = response.headers['set-cookie'];
    if (cookies)
      response.headers['set-cookie'] = cookies.map((cookie) =>
        cookie.replace(/;\s*Secure\b/gi, ''),
      );
  },
};

export default {
  dev: {
    '/api/': backend,
    '/desk': backend,
    '/socket.io': { ...backend, ws: true },
    '/assets/': {
      ...backend,
      // Let Umi serve this project's bundles; other apps' logos/assets belong to Frappe.
      bypass(request: { url?: string }) {
        if (request.url?.startsWith('/assets/rehab/console/'))
          return request.url;
        return undefined;
      },
    },
  },
  // 如果需要自定义本地开发服务器  请取消注释按需调整
  // dev: {
  //   // localhost:8000/api/** -> https://preview.pro.ant.design/api/**
  //   '/api/': {
  //     // 要代理的地址
  //     target: 'https://preview.pro.ant.design',
  //     // 配置了这个可以从 http 代理到 https
  //     // 依赖 origin 的功能可能需要这个，比如 cookie
  //     changeOrigin: true,
  //   },
  // },
  /**
   * @name 详细的代理配置
   * @doc https://github.com/chimurai/http-proxy-middleware
   */
  test: {
    // localhost:8000/api/** -> https://pro-api.ant-design-demo.workers.dev/api/**
    '/api/': {
      target: 'https://pro-api.ant-design-demo.workers.dev',
      changeOrigin: true,
    },
  },
  pre: {
    '/api/': {
      target: 'your pre url',
      changeOrigin: true,
    },
  },
};
