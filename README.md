# Rehab Console

English · [简体中文](README.zh-CN.md)

Rehab Console is a rehabilitation operations frontend for teams using Frappe. It uses React, TypeScript, Umi, and Ant Design Pro.

- **Clinical workflows** cover patient registration, encounters, physician orders, and assessment orders.
- **Therapy operations** cover team assignments, staff rosters, booking, and the therapist workstation.
- **Administration** includes treatment catalogs, equipment and room records, clinical templates, and question banks.
- **Treatment billing** connects completed treatment records to sales invoices, receipts, credit notes, and refunds.

The console uses the current Frappe session. The backend authorizes records and operations and returns the navigation available to each account. The interface currently uses Simplified Chinese for most rehabilitation workflows.

## Quick start

Install Node.js 22 or newer and npm. Use an isolated Frappe site with a compatible Rehab backend for authenticated workflows.

```bash
git clone https://github.com/jerry317395616/rehab-console.git
cd rehab-console
npm ci
npm run dev
```

Open [the local login page](http://localhost:8000/console/user/login). The development proxy defaults to `http://127.0.0.1:8001`. Set `REHAB_API_TARGET` to your development backend before starting the console.

```bash
REHAB_API_TARGET=http://127.0.0.1:8080 npm run dev
```

```powershell
$env:REHAB_API_TARGET = 'http://127.0.0.1:8080'
npm run dev
```

The public repository contains the frontend. Full clinical and billing workflows require the corresponding Rehab backend endpoints on Frappe. The frontend can be built and tested with synthetic responses without a backend account. See the [backend and deployment guide](docs/integration.md).

## Checks

```bash
npx playwright install chromium
npm run lint
npx antd lint ./src
npm test
npm run e2e
npm run build
```

## Contributing

See the [contribution guide](CONTRIBUTING.md) for development, testing, and review. Use [private vulnerability reporting](SECURITY.md) for security issues.

The next priorities are a public synthetic-data demo, a versioned backend compatibility matrix, and more end-to-end coverage for booking and billing.

Rehab Console is distributed under the [MIT License](LICENSE) and builds on [Ant Design Pro](https://github.com/ant-design/ant-design-pro).
