export interface Product {
  id: string;
  nome: string;
  estoque_atual: number;
  valor_venda: number;
  created_at: string;
}

export interface StockEntry {
  id: string;
  produto_id: string;
  quantidade_entrada: number;
  data_entrada: string;
  observacao?: string;
  created_at: string;
  // Join data
  produto?: Product;
}

export interface Conference {
  id: string;
  data_conferencia: string;
  total_vendido: number;
  created_at: string;
  items?: ConferenceItem[];
}

export interface ConferenceItem {
  id: string;
  conferencia_id: string;
  produto_id: string;
  estoque_anterior: number;
  estoque_contado: number;
  quantidade_saida: number;
  valor_unitario: number;
  valor_total: number;
  created_at: string;
  // Join data
  produto?: Product;
}

export type Tab = 
  | 'dashboard' 
  | 'products' 
  | 'entry' 
  | 'conference' 
  | 'history_entries' 
  | 'history_conferences' 
  | 'reports';
