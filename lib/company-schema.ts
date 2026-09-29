import {z} from 'zod';
import {COMPANIES,TRACKED_COMPANIES} from './domain.mjs';
export const companySchema=z.enum(COMPANIES.map(c=>c.name) as [string,...string[]]);
export const trackedCompanySchema=z.enum(TRACKED_COMPANIES as [string,...string[]]);
