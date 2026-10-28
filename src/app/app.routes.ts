import { Routes } from '@angular/router';
import { guardaLogado, guardaVisitante } from './core/auth.guard';

// O "GPS" do app: cada endereço leva a uma tela
export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'app/inicio' },
  {
    path: 'entrar',
    canActivate: [guardaVisitante],
    loadComponent: () => import('./pages/login/login.page').then((m) => m.LoginPage),
  },
  {
    path: 'perfil',
    canActivate: [guardaLogado],
    loadComponent: () => import('./pages/perfil/perfil.page').then((m) => m.PerfilPage),
  },
  {
    path: 'app',
    canActivate: [guardaLogado],
    loadComponent: () => import('./pages/abas/abas.page').then((m) => m.AbasPage),
    children: [
      { path: 'inicio', loadComponent: () => import('./pages/inicio/inicio.page').then((m) => m.InicioPage) },
      { path: 'biblioteca', loadComponent: () => import('./pages/biblioteca/biblioteca.page').then((m) => m.BibliotecaPage) },
      { path: 'resenhas', loadComponent: () => import('./pages/resenhas/resenhas.page').then((m) => m.ResenhasPage) },
      { path: 'desafios', loadComponent: () => import('./pages/desafios/desafios.page').then((m) => m.DesafiosPage) },
      { path: 'encontros', loadComponent: () => import('./pages/encontros/encontros.page').then((m) => m.EncontrosPage) },
      { path: '', pathMatch: 'full', redirectTo: 'inicio' },
    ],
  },
  { path: '**', redirectTo: '' },
];
