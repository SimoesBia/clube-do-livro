<p align="center">
  <img src="src/assets/logo-court-of-books.png" alt="Logo do Court of Books" width="200" />
</p>

<h1 align="center">Court of Books</h1>
<p align="center"><em>Um clube do livro nada diplomático.</em> 📚⚖️</p>

Aplicativo para o meu clube do livro, que antes funcionava só num grupo de WhatsApp. Cada pessoa tem sua conta e sua boneca, e o app organiza o livro do mês, as sugestões e a roleta de sorteio, os encontros, as resenhas e os desafios de leitura.

> Projeto em desenvolvimento, feito como projeto avaliativo do curso de Ciência da Computação.

## Funcionalidades

- Cadastro e login (nome, e-mail, data de aniversário e escolha de uma entre 36 bonecas ilustradas)
- **Aro** ao redor da boneca que evolui com os desafios (vinho, bronze, prata, ouro e diamante), **troféu** ao lado de quem já ganhou e cartãozinho de resumo ao tocar no avatar de qualquer pessoa
- Aniversariantes do mês e destaque para quem faz aniversário no dia
- Livro do mês com capa, ano, páginas e descrição em português
- Sugestões de livros (1 por pessoa) e **roleta** em SVG com as cores do clube; o sorteio é feito no servidor e aparece girando **ao vivo** para todo mundo
- **Biblioteca**: estante dos livros lidos pelo clube e uma aba "Descobrir" com livros em alta, lançamentos, categorias e "surpreenda-me"
- Livros lidos de cada pessoa (antes, durante e fora do clube), com contador no perfil
- **Encontros**: calendário de dias livres com "mapa de calor" dos melhores dias, recadinhos por mês e link do encontro online
- **Resenhas** no estilo "ficha de leitura": nota, tempo de leitura, aviso de spoiler, curtidas e comentários
- **Desafios de leitura**: criar desafios (por livros, páginas ou minutos), convidar pessoas, "corrida" com o avatar de cada participante, chat do desafio, pódio de 1º a 3º (empate divide) e troféus que atualizam o aro do avatar
- **Notificações** (sininho): convites de desafio, resultado do sorteio, novo livro do mês, comentários e curtidas nas suas resenhas, e aniversários do dia, tudo ao vivo
- Ferramentas de quem administra: escolher e tirar o livro do mês, remover livros da estante, zerar a roleta e definir o link do encontro
- Animações: brilhinhos ao tocar nos botões, cartões que surgem ao rolar e detalhes que se mexem

**Próximos passos**
- Biblioteca digital com arquivos (EPUB e PDF)
- Publicação gratuita como PWA

## De onde vêm os livros (APIs)

| API | Para que o app usa |
|---|---|
| **Google Livros** (em português) | busca, títulos, descrições, capas e categorias das edições brasileiras |
| **Open Library** | complementa a busca (filtro de idioma português), completa capas, ano e páginas, guarda o código da obra e alimenta a categoria "Mundo" (livros em alta no mundo, via Trending API) |

A Open Library tem a maior parte do acervo em inglês, por isso o Google Livros é a fonte principal dos textos em português. Se o Google não responder, o app mostra livros da Open Library que têm edição em português. Descrições em inglês podem ser traduzidas com um toque (serviço gratuito MyMemory). O Google Livros pode limitar as buscas sem chave; criar uma chave gratuita é opcional (`googleLivrosChave` no `environment.ts`).

## Tecnologias

| Parte | O que usei |
|---|---|
| App | Ionic 9 + Angular (componentes standalone, signals) + TypeScript |
| Banco de dados e login | Supabase (PostgreSQL, Auth, Realtime) |
| Segurança | Row Level Security (RLS), permissões por coluna e função de sorteio no servidor |
| Dados de livros | Google Livros API + Open Library API |
| Visual | SCSS, SVG, animações CSS, fontes Fraunces, Quicksand e Caveat |

## Segurança (resumo)

- Todas as tabelas têm **RLS** ligada: ninguém lê nem altera nada sem uma regra liberando.
- Cada pessoa só edita o **próprio** perfil, e só as colunas nome, aniversário e avatar (assim ninguém consegue se dar "admin" ou troféus pela internet). Os contadores de desafios e troféus são calculados por gatilhos no banco.
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
5. `05_bloco3.sql` — dados extras dos livros, livros lidos, curtidas e sorteio atualizado
6. `06_bloco4_desafios.sql` — desafios, convites, corrida, chat, troféus e segurança
7. `07_ajustes_e_notificacoes.sql` — ferramentas de limpeza e notificações

Depois, em *Authentication*, desligue "Confirm email" para testar, crie sua conta no app e torne-a administradora (instruções no final do `03_bloco2.sql`).

## Estrutura

```
src/app/
  core/      serviços (login, clube, desafios, APIs de livros, livros lidos), modelos e "porteiros" de rota
  shared/    componentes reutilizáveis (avatar, roleta, calendário, busca e ficha de livro...)
  pages/     telas (login, início, resenhas, desafios, encontros, perfil)
supabase/    scripts SQL do banco
```

## Capturas de tela

_(adicione aqui prints do app: login, início com a roleta, calendário, resenhas e desafios)_

## Autoria

Desenvolvido por _(seu nome e links aqui)_.
