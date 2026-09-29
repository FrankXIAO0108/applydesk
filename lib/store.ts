import {env} from 'cloudflare:workers';
export function database(){if(!env.DB)throw new Error('数据库尚未连接');return env.DB;}
export function event(owner:string,jobId:string|null,message:string){return database().prepare('INSERT INTO events (id,owner,jobId,message,createdAt) VALUES (?,?,?,?,?)').bind(crypto.randomUUID(),owner,jobId,message,new Date().toISOString());}
