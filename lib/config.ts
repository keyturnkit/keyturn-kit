// The only file you need to edit to sell your extension.

export const config = {
  provider: 'lemonsqueezy' as const,

  /** Where the Upgrade button sends people. Your Lemon Squeezy checkout link. */
  checkoutUrl: 'https://YOUR-STORE.lemonsqueezy.com/buy/YOUR-VARIANT-ID',

  lemonsqueezy: {
    /** Settings > Stores in the Lemon Squeezy dashboard. */
    storeId: 0,
    /** Leave empty to accept any product in your store. */
    productIds: [] as number[],
  },

  /** How often to re-check the key with Lemon Squeezy. */
  recheckHours: 24,
  /** How long Pro keeps working when the license server can't be reached. */
  offlineGraceDays: 7,
};
