import {mkdirSync} from 'node:fs';
import path from 'node:path';
process.env.CLOUDFLARE_CF_FETCH_ENABLED='false';
process.env.WRANGLER_SEND_METRICS='false';
process.env.WRANGLER_WRITE_LOGS='false';
process.env.WRANGLER_LOG_PATH=path.resolve('.local/logs');
process.env.WRANGLER_REGISTRY_PATH=path.resolve('.local/registry');
process.env.MINIFLARE_REGISTRY_PATH=path.resolve('.local/miniflare');
mkdirSync('.local',{recursive:true});
