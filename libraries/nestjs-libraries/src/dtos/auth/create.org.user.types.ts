// Frontend-compatible types that don't import Prisma client runtime
export enum Provider {
  LOCAL = 'LOCAL',
  GITHUB = 'GITHUB',
  GOOGLE = 'GOOGLE',
  FARCASTER = 'FARCASTER',
  WALLET = 'WALLET',
  GENERIC = 'GENERIC'
}

export type CreateOrgUserDtoFrontend = {
  password?: string;
  provider: Provider;
  providerToken?: string;
  email?: string;
  company: string;
};