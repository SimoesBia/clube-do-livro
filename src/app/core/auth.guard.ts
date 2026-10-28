import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

// "Porteiro" 1: só deixa passar quem está logado
export const guardaLogado: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  await auth.pronto;
  return auth.logado() ? true : router.createUrlTree(['/entrar']);
};

// "Porteiro" 2: quem já está logado não precisa ver a tela de entrada de novo
export const guardaVisitante: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  await auth.pronto;
  return auth.logado() ? router.createUrlTree(['/app/inicio']) : true;
};
