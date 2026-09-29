import type { Metadata } from 'next';
import './desk.css';
export const metadata: Metadata = {title:'ApplyDesk · 求职投递工作台',description:'查看官网投递进度，确认匹配岗位，维护飞书投递记录。',icons:{icon:'/favicon.svg'}};
export default function RootLayout({children}:{children:React.ReactNode}) {return <html lang="zh-CN"><body>{children}</body></html>}
