<p align="center">
  <img src="src/assets/logo-court-of-books.png" alt="Logo do Court of Books" width="200" />
</p>

<h1 align="center">Court of Books</h1>
<p align="center"><em>Um clube do livro nada diplomático.</em> 📚⚖️</p>

Aplicativo para o meu clube do livro, que antes funcionava só num grupo de WhatsApp. Cada pessoa tem sua conta e sua boneca, e o app organiza o livro do mês, as sugestões e a roleta de sorteio, os encontros, as resenhas e os desafios de leitura.

> Projeto em desenvolvimento, feito como projeto avaliativo do curso de Ciência da Computação.

## Funcionalidades

**Já funcionando**
- Cadastro e login (nome, e-mail, data de aniversário e escolha de uma entre 36 bonecas prontas)
- Aniversariantes do mês e destaque para quem faz aniversário no dia
- Livro do mês com capa buscada automaticamente (Google Livros, com Open Library como reserva)
- Sugestões de livros e **roleta** em SVG com as cores do clube; o sorteio é feito no servidor e aparece girando **ao vivo** para todo mundo
- Calendário de dias livres com "mapa de calor" dos melhores dias e recadinhos por mês
- Resenhas no estilo "ficha de leitura": nota, tempo de leitura, aviso de spoiler e comentários
- Aba de desafios com níveis (aro do avatar: vinho, bronze, prata, ouro e diamante) e placar de troféus

**Próximos passos**
- Criar desafios, convidar pessoas e chat de cada desafio
- Biblioteca digital (EPUB e PDF)
- Notificações (aniversários, convites e resultado do sorteio)
- Link do encontro online (Meet)
- Publicação gratuita como PWA

## Tecnologias

| Parte | O que usei |
|---|---|
| App | Ionic 9 + Angular (componentes standalone, signals) + TypeScript |
| Banco de dados e login | Supabase (PostgreSQL, Auth, Realtime) |
| Segurança | Row Level Security (RLS), permissões por coluna e função de sorteio no servidor |
| Visual | SCSS, SVG, fontes Fraunces, Quicksand e Caveat |

## Segurança (resumo)

- Todas as tabelas têm **RLS** ligada: ninguém lê nem altera nada sem uma regra liberando.
- Cada pessoa só edita o **próprio** perfil, e só as colunas nome, aniversário e avatar (assim ninguém consegue se dar "admin" ou troféus pela internet).
- O sorteio é feito por uma função no banco (`realizar_sorteio`), que só quem administra o clube consegue chamar. O resultado é igual para todo mundo.
- O caminho das imagens dos avatares nunca vem direto do banco: o app confere o código numa lista fixa antes de usar.
- As chaves do projeto ficam fora do repositório (`.gitignore`).

## Como rodar

Você vai precisar de [Node.js](https://nodejs.org/) e de uma conta gratuita no [Supabase](https://supabase.com/).

```bash
# 1. instalar o Ionic e as dependências
npm install -g @ionic/cli
npm install

# 2. configurar as chaves
#    copie src/environments/environment.example.ts para
#    src/environments/environment.ts e environment.prod.ts
#    e preencha com a URL e a chave pública do seu projeto no Supabase

# 3. rodar
ionic serve
```

**Banco de dados:** no Supabase, abra *SQL Editor* e rode, nesta ordem, os arquivos da pasta [`supabase/`](supabase):

1. `01_base.sql` — perfis e gatilho de cadastro
2. `02_avatares.sql` — escolha da boneca
3. `03_bloco2.sql` — livros, roleta, encontros, resenhas e segurança
4. `04_uma_sugestao_por_pessoa.sql` — limite de 1 sugestão por pessoa (opcional se o 03 já foi rodado na versão nova)

Depois, em *Authentication*, desligue "Confirm email" para testar, crie sua conta no app e torne-a administradora (instruções no final do `03_bloco2.sql`).

## Estrutura

```
src/app/
  core/      serviços (login, clube, busca de livros), modelos e "porteiros" de rota
  shared/    componentes reutilizáveis (avatar, roleta, calendário, busca de livro...)
  pages/     telas (login, início, resenhas, desafios, encontros, perfil)
supabase/    scripts SQL do banco
```

## Capturas de tela

_(adicionarei assim que começar a fase de testes)

## Autoria

Desenvolvido por _(Bruna Simomes)_.
