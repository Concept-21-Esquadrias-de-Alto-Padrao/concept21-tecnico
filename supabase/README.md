# Aplicacao manual no Supabase

No SQL Editor do Supabase, execute somente arquivos `.sql`.

Ordem correta:

1. Abra `supabase/migrations/20260730183000_technical_module.sql`.
2. Copie todo o conteudo e execute no SQL Editor.
3. Depois abra `supabase/migrations/20260731090000_access_signup_flow.sql`.
4. Copie todo o conteudo e execute no SQL Editor.
5. Depois abra `supabase/seed.sql`.
6. Copie todo o conteudo e execute no SQL Editor.

Se aparecer erro como:

```text
syntax error at or near "{"
LINE 1: import { NextResponse } from "next/server";
```

o arquivo colado nao e o seed. Esse trecho pertence ao codigo Next.js da aplicacao, por exemplo `src/app/api/auth/current-access/route.ts`, e nao pode ser executado no banco.
