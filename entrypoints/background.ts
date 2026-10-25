import { license } from '@/lib/license';

export default defineBackground(() => {
  // Re-check the license daily even if the popup is never opened.
  browser.alarms.create('license-recheck', { periodInMinutes: 60 });
  browser.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === 'license-recheck') void license.refresh();
  });
  browser.runtime.onStartup.addListener(() => void license.refresh());
});
