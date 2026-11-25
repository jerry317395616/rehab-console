# Contributing to Rehab Console

Issues and pull requests can be written in English or Chinese. Include the affected workflow, expected and observed behavior, and steps using synthetic data. When a bug depends on the backend, include the installed Frappe and Rehab versions and the role or relevant DocType permissions.

1. Fork the repository and create a focused branch.
2. Run `npm ci` and `npm run dev`. For backend integration, follow the [setup guide](docs/integration.md) and use an isolated development site.
3. Run the checks in the [README](README.md). Update the relevant test when a change affects an existing workflow.
4. Open a pull request describing the user-facing change and how you verified it. For visual changes, attach images that contain only synthetic data.

Use TypeScript and the shared Ant Design components. Keep business access checks on the backend and reuse the existing API services. Do not attach patient records, credentials, session cookies, or private deployment details to public issues or pull requests.

See the [Code of Conduct](CODE_OF_CONDUCT.md) and [Security Policy](SECURITY.md).
