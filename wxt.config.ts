import { defineConfig } from 'wxt';

// See https://wxt.dev/api/reference/wxt/interfaces/inlineconfig.html
export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  manifest: {
    name: 'My Extension',
    description: 'Replace with your extension description.',
    permissions: ['storage', 'alarms'],
    host_permissions: ['https://api.lemonsqueezy.com/*'],
  },
});
