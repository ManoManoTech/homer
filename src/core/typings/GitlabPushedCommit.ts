/**
 * Comes from webhook.
 */
export interface GitlabPushedCommit {
  added: string[]; // ex: ['src/domains/productDiscovery/productDiscovery.model.ts']
  author: {
    name: string; // ex: 'Josselin'
    email: string;
  };
  id: string; // ex: 'c9b11a6ba50c8bc695f096476b9402d0cc76bbce'
  message: string; // ex: 'feat(misc): change productsearch store into productdiscovery\n\nJIRA: MERCH-339\n'
  modified: string[]; // ex: ['src/domains/productDiscovery/productDiscovery.model.ts']
  removed: string[]; // ex: ['src/domains/productDiscovery/productDiscovery.model.ts']
  timestamp: string; // ex: '2020-11-05T18:33:46+01:00'
  title: string; // ex: 'feat(misc): change productsearch store into productdiscovery'
  url: string;
}
