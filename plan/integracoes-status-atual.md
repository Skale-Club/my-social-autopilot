# Status Atual das Integrações (Telegram + Ads Tracking)

Data: 2026-03-05

## Escopo solicitado
- Ajustar Telegram para notificar novo cadastro.
- Preparar estrutura para GA4 + Facebook Dataset.
- Salvar e exibir no Admin todos os eventos gravados pelo sistema.

## O que já foi feito

### Telegram (concluído)
- Campo de configuração alterado de `notify_on_new_chat` para `notify_on_new_signup` (com compatibilidade retroativa).
- UI do Admin atualizada para refletir “Notify on new signup”.
- Fluxo de notificação de signup implementado com endpoint dedicado:
  - `POST /api/telegram/notify-signup`
- Mensagem enviada ao Telegram com dados do usuário (email, user id, provider, created_at e referrer quando existir).
- Idempotência implementada para evitar notificações duplicadas.
- Migration criada para suporte de idempotência:
  - `supabase/migrations/20260305203000_telegram_signup_notifications.sql`

### Frontend/Auth (concluído para Telegram)
- `client/src/lib/auth.tsx` chama o endpoint de notificação após autenticação.

### Qualidade
- `npm run check` já passou após as mudanças do Telegram.

## O que foi iniciado (parcial, ainda não concluído)
- Serviço novo para tracking de marketing:
  - `server/integrations/marketing.ts`
- Arquivos adicionais de Facebook existentes no workspace, mas ainda sem fechamento do fluxo completo no sistema:
  - `server/integrations/facebook.ts`
  - `supabase/migrations/20260305185606_facebook_conversions_api.sql`

## O que falta fazer

### Banco / Schema
- Criar estrutura definitiva de eventos de marketing (ex.: tabela `marketing_events`).
- Criar migration idempotente para:
  - log de eventos;
  - status de entrega GA4 e Facebook Dataset;
  - deduplicação por `event_key`.
- Atualizar `supabase-setup.sql` com essa estrutura.
- Atualizar `shared/schema.ts` com:
  - schemas de config/status de GA4;
  - schemas de config/status de Facebook Dataset;
  - schema de listagem de eventos de marketing.

### Backend (Admin)
- Implementar rotas de configuração GA4:
  - `GET /api/admin/ga4`
  - `PUT /api/admin/ga4`
  - `POST /api/admin/ga4/test`
- Implementar rotas de configuração Facebook Dataset:
  - `GET /api/admin/facebook-dataset`
  - `PUT /api/admin/facebook-dataset`
  - `POST /api/admin/facebook-dataset/test`
- Implementar rota para leitura dos eventos gravados:
  - `GET /api/admin/marketing-events`
- Incluir flags no status geral de integrações (`/api/admin/integrations/status`) para GA4 e Facebook Dataset.

### Backend (Tracking real de eventos)
- Conectar tracking automático nos fluxos principais:
  - signup
  - generate
  - edit
  - transcribe
- Garantir fallback seguro: erro de tracking não deve quebrar fluxo principal.

### Frontend Admin
- Adicionar cards no `IntegrationsTab` para:
  - GA4
  - Facebook Dataset
- Adicionar bloco/tabela de “Eventos gravados” no Admin com:
  - evento, fonte, usuário/email, data, status GA4, status Facebook.

### Finalização
- Executar `npm run check`.
- Teste manual ponta a ponta no Admin:
  - salvar config;
  - testar conexão;
  - gerar evento real e confirmar log + status.

## Estado atual dos arquivos modificados no workspace
- `client/src/components/admin/integrations-tab.tsx`
- `client/src/lib/auth.tsx`
- `client/src/lib/translations.ts`
- `server/routes/integrations.routes.ts`
- `shared/schema.ts`
- `supabase-setup.sql`
- `server/integrations/marketing.ts` (novo)
- `server/integrations/facebook.ts` (novo, ainda não consolidado)
- `supabase/migrations/20260305185606_facebook_conversions_api.sql` (novo, ainda não consolidado)
- `supabase/migrations/20260305203000_telegram_signup_notifications.sql` (novo)

