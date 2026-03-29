# JurisConnect - MVP de marketplace jurídico

Este pacote entrega uma base funcional para evoluir o site em um marketplace de delegação jurídica, com:

- página pública de solicitação de serviços;
- cálculo automático de valor por tipo de peça;
- integração inicial com Mercado Pago;
- botão de WhatsApp para envio de comprovante + dados do pedido;
- painel administrativo para visualizar pedidos e editar preços;
- base simples em JSON, suficiente para MVP local.

## Estrutura

- `server.js`: backend Node/Express
- `data/db.json`: base de dados simples
- `public/index.html`: página principal
- `public/admin.html`: painel do administrador
- `public/painel-advogado.html`: página provisória do advogado delegado
- `public/payment-result.html`: retorno de pagamento
- `public/app.js`: lógica da página principal
- `public/admin.js`: lógica do painel administrativo
- `public/styles.css`: estilos globais
- `.env.example`: variáveis de ambiente

## Como instalar

1. Extraia o pacote.
2. No terminal, dentro da pasta do projeto, execute:

```bash
npm install
```

3. Crie um arquivo `.env` com base no `.env.example`.

4. Inicie o projeto:

```bash
npm start
```

5. Abra no navegador:

```bash
http://localhost:3000
```

## Credenciais iniciais do painel

- E-mail: `admin@jurisconnect.com`
- Senha: `123456`

## Mercado Pago

Para habilitar o checkout real, preencha no `.env`:

- `MERCADOPAGO_ACCESS_TOKEN`
- `MERCADOPAGO_PUBLIC_KEY`
- `BASE_URL`

Observação: o webhook exige uma URL pública válida para funcionar corretamente. Em ambiente local, o registro da notificação já fica preparado, mas a confirmação automática do pagamento dependerá de ambiente publicado.

## Próximas evoluções recomendadas

- autenticação real com hash de senha;
- banco PostgreSQL/Supabase;
- upload de anexos;
- painel do advogado delegado;
- aceite automático/manual de demandas;
- repasse financeiro e split de pagamentos.
