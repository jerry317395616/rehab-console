# 康复工作台 Rehab Console

[English](README.md) · 简体中文

康复工作台是面向 Frappe 的康复业务前端，使用 React、TypeScript、Umi 和 Ant Design Pro 开发。

- **患者与临床**覆盖患者注册、就诊、医生工作站、治疗医嘱和评估医嘱。
- **排班与治疗**覆盖治疗分派、人员班次、治疗预约和治疗师工作站。
- **基础数据**包括医嘱与治疗项目、治疗资源、设备、病历模板和量表题库。
- **治疗收费**关联实际治疗记录、销售发票、收款凭证、贷项和退款。

前端复用 Frappe 登录会话，按服务端返回的权限展示应用和菜单。单据审批、写入和业务校验由后端负责。

## 本地启动

准备 Node.js 22 或更新版本与 npm。需要联调业务时，使用装有兼容 Rehab 后端的隔离 Frappe 站点。

```bash
git clone https://github.com/jerry317395616/rehab-console.git
cd rehab-console
npm ci
npm run dev
```

打开[本地登录页](http://localhost:8000/console/user/login)。开发代理默认连接 `http://127.0.0.1:8001`。要连接其他开发站点，在启动前设置 `REHAB_API_TARGET`。Windows PowerShell 示例为 `$env:REHAB_API_TARGET = 'http://127.0.0.1:8080'`。

本仓库提供前端源码。完整临床和收费流程需要 Frappe 上相应的 Rehab 后端接口。构建和模拟测试可以独立运行，接入方法见[后端与部署指南](docs/integration.md)。

## 参与项目

查看[贡献指南](CONTRIBUTING.md)了解开发和测试，安全问题请走[私密报告渠道](SECURITY.md)。接下来优先补齐可公开体验的模拟数据演示、后端兼容版本说明，以及预约和收费的端到端测试。

项目采用 [MIT 许可证](LICENSE)，前端基础来自 [Ant Design Pro](https://github.com/ant-design/ant-design-pro)。
