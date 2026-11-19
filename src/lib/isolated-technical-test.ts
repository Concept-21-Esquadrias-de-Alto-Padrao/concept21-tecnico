// Only the existing isolated TESTE database may use its own authenticated test accounts.
export function isolatedTechnicalTest(env:Record<string,string|undefined>=process.env){
 return env.VERCEL_ENV==='preview'&&env.TECHNICAL_TEST_LOCAL_AUTH==='true'&&env.NEXT_PUBLIC_SUPABASE_URL==='https://rnuanogfbhhphnnqxugf.supabase.co';
}
