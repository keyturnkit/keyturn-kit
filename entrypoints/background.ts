import { license } from '@/lib/license';

export default defineBackground(() => {
  // Open the options page once after a fresh install so a buyer who paid first can paste the key right away.
  // Registered synchronously at the top level: a service worker only receives onInstalled if the listener exists on first run.
  browser.runtime.onInstalled.addListener(({ reason }) => {
    if (reason === 'install') void browser.runtime.openOptionsPage();
  });

  // Re-check the license even if the popup is never opened. refresh() only calls Lemon Squeezy once a day.
  // Create the alarm only if missing: re-creating it on every service worker wake resets its timer.
  void browser.alarms.get('license-recheck').then((a) => {
    if (!a) browser.alarms.create('license-recheck', { periodInMinutes: 60 });
  });
  browser.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === 'license-recheck') void license.refresh();
  });
  browser.runtime.onStartup.addListener(() => void license.refresh());
});
