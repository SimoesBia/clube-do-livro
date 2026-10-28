import { Injectable } from '@angular/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { environment } from '../../environments/environment';

// A "ponte" entre o app e o Supabase. Só existe uma, usada por todas as telas.
@Injectable({ providedIn: 'root' })
export class SupabaseService {
  readonly cliente: SupabaseClient;

  constructor() {
    if (environment.supabaseUrl.startsWith('COLE_AQUI') || environment.supabaseChave.startsWith('COLE_AQUI')) {
      throw new Error(
        'Falta colocar a URL e a chave pública do Supabase no arquivo src/environments/environment.ts',
      );
    }
    this.cliente = createClient(environment.supabaseUrl, environment.supabaseChave);
  }
}
