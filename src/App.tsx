/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { 
  LayoutDashboard, 
  Package, 
  History, 
  Plus, 
  Search, 
  ArrowUpRight, 
  ArrowDownLeft, 
  AlertTriangle, 
  MoreHorizontal,
  Edit2,
  Trash2,
  X,
  Filter,
  Download,
  TrendingUp,
  Box,
  DollarSign,
  ClipboardCheck,
  FileText,
  LogOut,
  ChevronRight,
  Calendar,
  User,
  Lock,
  ArrowRight,
  TrendingDown,
  BarChart3,
  Menu,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Product, StockEntry, Conference, Tab } from './types';
import { supabase } from './lib/supabase';

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [products, setProducts] = useState<Product[]>([]);
  const [history, setHistory] = useState<StockEntry[]>([]);
  const [audits, setAudits] = useState<Conference[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [isEntryModalOpen, setIsEntryModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [auditCounts, setAuditCounts] = useState<Record<string, number>>({});
  const [viewingAudit, setViewingAudit] = useState<Conference | null>(null);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{ title: string; message: string; onConfirm: () => void } | null>(null);

  const showNotification = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4000);
  };

  // Auth State
  useEffect(() => {
    const savedAuth = localStorage.getItem('estoqueapp_auth');
    if (savedAuth === 'true') setIsAuthenticated(true);
  }, []);

  // Load data from Supabase
  useEffect(() => {
    if (isAuthenticated) {
      fetchData();
    }
  }, [isAuthenticated]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [productsRes, historyRes, auditsRes] = await Promise.all([
        supabase.from('produtos').select('*').order('nome'),
        supabase.from('entradas_estoque').select('*, produto:produtos(*)').order('created_at', { ascending: false }),
        supabase.from('conferencias').select('*, items:conferencia_itens(*, produto:produtos(*))').order('created_at', { ascending: false })
      ]);

      if (productsRes.error) throw productsRes.error;
      if (historyRes.error) throw historyRes.error;
      if (auditsRes.error) throw auditsRes.error;

      setProducts(productsRes.data || []);
      setHistory(historyRes.data || []);
      setAudits(auditsRes.data || []);
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      showNotification('Erro ao carregar dados do servidor.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const user = formData.get('user') as string;
    const pass = formData.get('pass') as string;
    
    if (user.length >= 4 && pass.length >= 4) {
      setIsAuthenticated(true);
      localStorage.setItem('estoqueapp_auth', 'true');
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    localStorage.removeItem('estoqueapp_auth');
  };

  // Stats
  const stats = useMemo(() => {
    const totalItems = products.reduce((acc, p) => acc + p.estoque_atual, 0);
    const totalValue = products.reduce((acc, p) => acc + (p.estoque_atual * p.valor_venda), 0);
    
    // Calculate "Vendido" based on last audit
    const lastAudit = audits[0];
    const totalSoldValue = lastAudit?.total_vendido || 0;

    const recentEntries = history.slice(0, 5);
    
    return { totalItems, totalValue, totalSoldValue, recentEntries };
  }, [products, history, audits]);

  const filteredProducts = useMemo(() => {
    return products.filter(p => 
      p.nome.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [products, searchTerm]);

  const handleSaveProduct = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const nome = formData.get('name') as string;
    const estoque_atual = Number(formData.get('quantity'));
    const valor_venda = Number(formData.get('price'));

    try {
      if (editingProduct) {
        const { error } = await supabase
          .from('produtos')
          .update({ nome, estoque_atual, valor_venda })
          .eq('id', editingProduct.id);
        if (error) throw error;
        showNotification('Produto atualizado com sucesso!', 'success');
      } else {
        const { error } = await supabase
          .from('produtos')
          .insert([{ nome, estoque_atual, valor_venda }]);
        if (error) throw error;
        showNotification('Produto cadastrado com sucesso!', 'success');
      }
      
      await fetchData();
      setIsModalOpen(false);
      setEditingProduct(null);
    } catch (error) {
      console.error('Erro ao salvar produto:', error);
      showNotification('Erro ao salvar produto no banco.', 'error');
    }
  };

  const handleDeleteProduct = async (id: string) => {
    setConfirmDialog({
      title: 'Excluir Produto',
      message: 'Tem certeza que deseja excluir este produto? Esta ação não pode ser desfeita.',
      onConfirm: async () => {
        setConfirmDialog(null);
        try {
          const { error } = await supabase.from('produtos').delete().eq('id', id);
          if (error) throw error;
          showNotification('Produto excluído com sucesso!', 'success');
          await fetchData();
        } catch (error) {
          console.error('Erro ao excluir produto:', error);
          showNotification('Erro ao excluir produto. Verifique se existem entradas ou conferências vinculadas.', 'error');
        }
      }
    });
  };

  const handleRegisterEntry = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const produto_id = formData.get('productId') as string;
    const quantidade_entrada = Number(formData.get('quantity'));
    const data_entrada = formData.get('date') as string;
    const observacao = formData.get('note') as string;

    const product = products.find(p => p.id === produto_id);
    if (!product) return;

    try {
      // 1. Insert entry
      const { error: entryError } = await supabase
        .from('entradas_estoque')
        .insert([{ 
          produto_id, 
          quantidade_entrada, 
          data_entrada, 
          observacao 
        }]);
      
      if (entryError) {
        console.error('Erro detalhado no insert de entrada:', entryError);
        throw entryError;
      }

      // 2. Update product stock
      const { error: productError } = await supabase
        .from('produtos')
        .update({ estoque_atual: product.estoque_atual + quantidade_entrada })
        .eq('id', produto_id);
      
      if (productError) {
        console.error('Erro detalhado no update de estoque:', productError);
        throw productError;
      }

      await fetchData();
      setIsEntryModalOpen(false);
      setActiveTab('history_entries');
      showNotification('Entrada registrada com sucesso!', 'success');
    } catch (error) {
      console.error('Erro ao registrar entrada:', error);
      showNotification('Erro ao registrar entrada no banco.', 'error');
    }
  };

  const handleFinishAudit = async () => {
    if (products.length === 0) {
      showNotification('Não há produtos para conferir.', 'error');
      return;
    }

    setConfirmDialog({
      title: 'Finalizar Conferência',
      message: 'Deseja finalizar a conferência? O estoque de todos os produtos será atualizado para as quantidades contadas.',
      onConfirm: async () => {
        setConfirmDialog(null);
        setLoading(true);
        console.log('>>> INICIANDO FLUXO DE FINALIZAÇÃO DE CONFERÊNCIA <<<');
        
        try {
          const data_conferencia = new Date().toISOString();
          let total_vendido = 0;
          const itensParaInserir: any[] = [];
          const updatesProdutos: any[] = [];

          // A. Calcular valores e preparar dados
          products.forEach(p => {
            const estoque_contado = auditCounts[p.id] ?? p.estoque_atual;
            const estoque_anterior = p.estoque_atual;
            const quantidade_saida = estoque_anterior - estoque_contado;
            const valor_unitario = p.valor_venda;
            const valor_total = quantidade_saida > 0 ? quantidade_saida * valor_unitario : 0;

            if (quantidade_saida > 0) {
              total_vendido += valor_total;
            }

            itensParaInserir.push({
              produto_id: p.id,
              estoque_anterior,
              estoque_contado,
              quantidade_saida,
              valor_unitario,
              valor_total
            });

            updatesProdutos.push({
              id: p.id,
              estoque_atual: estoque_contado,
              nome: p.nome
            });
          });

          // B. Inserir em conferencias
          const { data: conference, error: confError } = await supabase
            .from('conferencias')
            .insert([{ data_conferencia, total_vendido }])
            .select()
            .single();
          
          if (confError) throw new Error(`Falha ao criar registro de conferência: ${confError.message}`);
          
          const conferencia_id = conference.id;

          // C. Inserir itens
          const itensComId = itensParaInserir.map(item => ({ ...item, conferencia_id }));
          const { error: itemsError } = await supabase.from('conferencia_itens').insert(itensComId);
          if (itemsError) throw new Error(`Falha ao inserir itens da conferência: ${itemsError.message}`);

          // D. Atualizar produtos
          const updatePromises = updatesProdutos.map(async (update) => {
            const { error: updateError } = await supabase
              .from('produtos')
              .update({ estoque_atual: update.estoque_atual })
              .eq('id', update.id);
            if (updateError) throw updateError;
          });
          await Promise.all(updatePromises);

          // E. Recarregar
          await fetchData();
          setAuditCounts({});
          showNotification('Conferência finalizada com sucesso! O estoque foi atualizado.', 'success');
          setActiveTab('history_conferences');
        } catch (error: any) {
          console.error('ERRO CRÍTICO NA FINALIZAÇÃO:', error);
          showNotification(`Erro ao finalizar conferência: ${error.message || 'Erro desconhecido'}`, 'error');
        } finally {
          setLoading(false);
        }
      }
    });
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md"
        >
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-sidebar rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
              <TrendingUp className="text-white w-10 h-10" />
            </div>
            <h1 className="text-3xl font-bold text-slate-800">EstoqueApp</h1>
            <p className="text-slate-500">Controle de estoque de bebidas</p>
          </div>

          <div className="card p-8">
            <form onSubmit={handleLogin} className="space-y-6">
              <div>
                <label className="text-sm font-semibold text-slate-600 mb-2 block">Usuário</label>
                <div className="relative">
                  <User className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input name="user" required className="input pl-11" placeholder="Seu usuário" />
                </div>
              </div>
              <div>
                <label className="text-sm font-semibold text-slate-600 mb-2 block">Senha</label>
                <div className="relative">
                  <Lock className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input name="pass" type="password" required className="input pl-11" placeholder="••••••" />
                </div>
              </div>
              <button type="submit" className="btn btn-primary w-full py-3 text-lg">
                Entrar <ArrowRight className="w-5 h-5" />
              </button>
            </form>
          </div>
          <p className="text-center text-slate-400 text-sm mt-6">Use qualquer usuário e senha (mín. 4 caracteres)</p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-bg overflow-hidden">
      {/* Mobile Overlay */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsMobileMenuOpen(false)}
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-30 lg:hidden"
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <aside className={`
        fixed inset-y-0 left-0 w-64 bg-sidebar flex flex-col shadow-xl z-40 transition-transform duration-300 transform
        lg:relative lg:translate-x-0
        ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="p-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-warning rounded-lg flex items-center justify-center shadow-md">
              <TrendingUp className="text-white w-6 h-6" />
            </div>
            <div>
              <h1 className="font-bold text-white tracking-tight">EstoqueApp</h1>
              <p className="text-[10px] text-slate-400 uppercase font-bold">Controle de Bebidas</p>
            </div>
          </div>
          <button onClick={() => setIsMobileMenuOpen(false)} className="lg:hidden text-slate-400 hover:text-white">
            <X className="w-6 h-6" />
          </button>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          <button onClick={() => { setActiveTab('dashboard'); setIsMobileMenuOpen(false); }} className={`sidebar-item ${activeTab === 'dashboard' ? 'sidebar-item-active' : ''}`}>
            <LayoutDashboard className="w-5 h-5" /> Dashboard
          </button>
          <button onClick={() => { setActiveTab('products'); setIsMobileMenuOpen(false); }} className={`sidebar-item ${activeTab === 'products' ? 'sidebar-item-active' : ''}`}>
            <Package className="w-5 h-5" /> Produtos
          </button>
          <button onClick={() => { setActiveTab('entry'); setIsMobileMenuOpen(false); }} className={`sidebar-item ${activeTab === 'entry' ? 'sidebar-item-active' : ''}`}>
            <ArrowDownLeft className="w-5 h-5" /> Entrada
          </button>
          <button onClick={() => { setActiveTab('conference'); setIsMobileMenuOpen(false); }} className={`sidebar-item ${activeTab === 'conference' ? 'sidebar-item-active' : ''}`}>
            <ClipboardCheck className="w-5 h-5" /> Conferência
          </button>
          <div className="pt-4 pb-2 px-4">
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Histórico</p>
          </div>
          <button onClick={() => { setActiveTab('history_entries'); setIsMobileMenuOpen(false); }} className={`sidebar-item ${activeTab === 'history_entries' ? 'sidebar-item-active' : ''}`}>
            <History className="w-5 h-5" /> Hist. Entradas
          </button>
          <button onClick={() => { setActiveTab('history_conferences'); setIsMobileMenuOpen(false); }} className={`sidebar-item ${activeTab === 'history_conferences' ? 'sidebar-item-active' : ''}`}>
            <History className="w-5 h-5" /> Hist. Conferências
          </button>
          <button onClick={() => { setActiveTab('reports'); setIsMobileMenuOpen(false); }} className={`sidebar-item ${activeTab === 'reports' ? 'sidebar-item-active' : ''}`}>
            <FileText className="w-5 h-5" /> Relatórios
          </button>
        </nav>

        <div className="p-4 border-t border-slate-700">
          <button onClick={handleLogout} className="sidebar-item text-slate-400 hover:text-white">
            <LogOut className="w-5 h-5" /> Sair
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden w-full">
        <header className="h-16 border-b border-border bg-surface flex items-center px-4 lg:px-8 shadow-sm z-10 justify-between lg:justify-start">
          <button onClick={() => setIsMobileMenuOpen(true)} className="lg:hidden p-2 text-slate-600 hover:bg-slate-100 rounded-lg">
            <Menu className="w-6 h-6" />
          </button>
          <h2 className="text-lg font-semibold text-slate-700">
            {activeTab === 'dashboard' && 'Dashboard'}
            {activeTab === 'products' && 'Produtos'}
            {activeTab === 'entry' && 'Entrada'}
            {activeTab === 'conference' && 'Conferência'}
            {activeTab === 'history_entries' && 'Histórico de Entradas'}
            {activeTab === 'history_conferences' && 'Histórico de Conferências'}
            {activeTab === 'reports' && 'Relatórios'}
          </h2>
          <div className="w-10 lg:hidden" /> {/* Spacer for centering title on mobile if needed */}
        </header>

        <div className="flex-1 overflow-y-auto p-4 lg:p-8">
          {!(import.meta as any).env.VITE_SUPABASE_ANON_KEY && (
            <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-center gap-3 text-amber-800">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <div className="text-sm">
                <p className="font-bold">Configuração Necessária</p>
                <p>A chave do Supabase não foi encontrada. Por favor, configure <strong>VITE_SUPABASE_ANON_KEY</strong> no menu Settings para ativar o banco de dados.</p>
              </div>
            </div>
          )}
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-sidebar"></div>
            </div>
          ) : (
            <AnimatePresence mode="wait">
              {activeTab === 'dashboard' && (
                <motion.div key="dashboard" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">
                  {/* Stats Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <div className="card p-6 flex items-center gap-4">
                      <div className="p-3 bg-blue-50 rounded-xl text-blue-600"><Package className="w-6 h-6" /></div>
                      <div>
                        <p className="text-xs font-bold text-slate-400 uppercase">Produtos</p>
                        <p className="text-2xl font-bold">{products.length}</p>
                      </div>
                    </div>
                    <div className="card p-6 flex items-center gap-4">
                      <div className="p-3 bg-cyan-50 rounded-xl text-cyan-600"><Box className="w-6 h-6" /></div>
                      <div>
                        <p className="text-xs font-bold text-slate-400 uppercase">Itens em Estoque</p>
                        <p className="text-2xl font-bold">{stats.totalItems}</p>
                      </div>
                    </div>
                    <div className="card p-6 flex items-center gap-4">
                      <div className="p-3 bg-green-50 rounded-xl text-green-600"><DollarSign className="w-6 h-6" /></div>
                      <div>
                        <p className="text-xs font-bold text-slate-400 uppercase">Valor do Estoque</p>
                        <p className="text-2xl font-bold">R$ {stats.totalValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    <div className="card p-6">
                      <div className="flex items-center gap-2 mb-6">
                        <TrendingDown className="w-5 h-5 text-cyan-600" />
                        <h3 className="font-bold text-slate-700">Maior Saída (Última Conf.)</h3>
                      </div>
                      {audits[0] ? (
                        <div className="space-y-3">
                          {audits[0].items?.filter(i => i.diferenca < 0).sort((a, b) => a.diferenca - b.diferenca).slice(0, 1).map(i => (
                            <div key={i.id} className="flex items-center justify-between p-2">
                              <span className="text-sm font-medium">{i.produto?.nome}</span>
                              <span className="text-sm font-bold text-danger">{i.diferenca}</span>
                            </div>
                          ))}
                          {audits[0].items?.filter(i => i.diferenca < 0).length === 0 && (
                            <p className="text-sm text-slate-400 italic">Nenhuma saída na última conferência</p>
                          )}
                        </div>
                      ) : (
                        <p className="text-sm text-slate-400 italic">Nenhuma conferência realizada</p>
                      )}
                    </div>

                    <div className="card p-6">
                      <div className="flex items-center gap-2 mb-6">
                        <ArrowDownLeft className="w-5 h-5 text-green-600" />
                        <h3 className="font-bold text-slate-700">Últimas Entradas</h3>
                      </div>
                      <div className="space-y-3">
                        {stats.recentEntries.length > 0 ? (
                          stats.recentEntries.map(e => (
                            <div key={e.id} className="flex items-center justify-between p-2 hover:bg-slate-50 rounded transition-colors">
                              <span className="text-sm font-medium">{e.produto?.nome}</span>
                              <span className="text-sm font-bold text-success">+{e.quantidade_entrada}</span>
                            </div>
                          ))
                        ) : (
                          <p className="text-sm text-slate-400 italic">Nenhuma entrada registrada</p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* New Stock Overview Section */}
                  <div className="card">
                    <div className="p-6 border-b border-border flex flex-col sm:flex-row items-center justify-between gap-4">
                      <div className="flex items-center gap-2">
                        <Box className="w-5 h-5 text-accent" />
                        <h3 className="font-bold text-slate-700">Posição Atual de Estoque</h3>
                      </div>
                      <div className="relative w-full sm:w-64">
                        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input 
                          type="text" 
                          placeholder="Filtrar estoque..." 
                          className="input pl-10 py-1.5 text-sm"
                          onChange={(e) => setSearchTerm(e.target.value)}
                        />
                      </div>
                    </div>
                    <div className="block">
                      {/* Desktop Table */}
                      <table className="w-full hidden md:table">
                        <thead>
                          <tr>
                            <th className="table-header">Produto</th>
                            <th className="table-header">Quantidade</th>
                            <th className="table-header">Status</th>
                            <th className="table-header text-right">Valor Total</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {products
                            .filter(p => p.nome.toLowerCase().includes(searchTerm.toLowerCase()))
                            .map(p => (
                            <tr key={p.id} className="hover:bg-slate-50/50 transition-colors">
                              <td className="table-cell font-bold">{p.nome}</td>
                              <td className="table-cell">
                                <span className={`font-bold ${p.estoque_atual <= 5 ? 'text-danger' : 'text-slate-700'}`}>
                                  {p.estoque_atual}
                                </span>
                              </td>
                              <td className="table-cell">
                                {p.estoque_atual <= 5 ? (
                                  <span className="badge bg-red-100 text-red-600 flex items-center gap-1 w-fit">
                                    <AlertTriangle className="w-3 h-3" /> Baixo
                                  </span>
                                ) : (
                                  <span className="badge bg-emerald-100 text-emerald-600 w-fit">Normal</span>
                                )}
                              </td>
                              <td className="table-cell text-right font-bold">
                                R$ {(p.estoque_atual * p.valor_venda).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>

                      {/* Mobile Card List */}
                      <div className="md:hidden divide-y divide-border">
                        {products
                          .filter(p => p.nome.toLowerCase().includes(searchTerm.toLowerCase()))
                          .map(p => (
                          <div key={p.id} className="p-4 space-y-3">
                            <div className="flex justify-between items-start">
                              <span className="font-bold text-slate-700">{p.nome}</span>
                              {p.estoque_atual <= 5 ? (
                                <span className="badge bg-red-100 text-red-600 flex items-center gap-1">
                                  <AlertTriangle className="w-3 h-3" /> Baixo
                                </span>
                              ) : (
                                <span className="badge bg-emerald-100 text-emerald-600">Normal</span>
                              )}
                            </div>
                            <div className="flex justify-between text-sm">
                              <div className="text-slate-500">
                                Qtd: <span className={`font-bold ${p.estoque_atual <= 5 ? 'text-danger' : 'text-slate-700'}`}>{p.estoque_atual}</span>
                              </div>
                              <div className="text-slate-500">
                                Total: <span className="font-bold text-slate-700">R$ {(p.estoque_atual * p.valor_venda).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>

                      {products.length === 0 && (
                        <div className="p-10 text-center text-slate-400 italic">
                          Nenhum produto cadastrado no estoque
                        </div>
                      )}
                    </div>
                  </div>
                </motion.div>
              )}

              {activeTab === 'products' && (
                <motion.div key="products" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="relative w-full sm:w-96">
                      <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input 
                        type="text" 
                        placeholder="Buscar produto..." 
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="input pl-10"
                      />
                    </div>
                    <button onClick={() => { setEditingProduct(null); setIsModalOpen(true); }} className="btn btn-primary w-full sm:w-auto">
                      <Plus className="w-5 h-5" /> Novo Produto
                    </button>
                  </div>

                  <div className="card">
                    {filteredProducts.length === 0 ? (
                      <div className="p-20 text-center space-y-4">
                        <Box className="w-16 h-16 text-slate-200 mx-auto" />
                        <p className="text-slate-400">Nenhum produto encontrado</p>
                      </div>
                    ) : (
                      <div className="block">
                        {/* Desktop Table */}
                        <table className="w-full hidden md:table">
                          <thead>
                            <tr>
                              <th className="table-header">Produto</th>
                              <th className="table-header">Quantidade</th>
                              <th className="table-header">Preço de Venda</th>
                              <th className="table-header text-right">Ações</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border">
                            {filteredProducts.map(p => (
                              <tr key={p.id} className="hover:bg-slate-50/50 transition-colors">
                                <td className="table-cell font-bold">{p.nome}</td>
                                <td className="table-cell">
                                  <span className="font-bold text-slate-700">
                                    {p.estoque_atual}
                                  </span>
                                </td>
                                <td className="table-cell font-bold">R$ {p.valor_venda.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                                <td className="table-cell text-right">
                                  <div className="flex items-center justify-end gap-2">
                                    <button onClick={() => { setEditingProduct(p); setIsModalOpen(true); }} className="p-2 hover:bg-slate-100 rounded-lg transition-colors text-slate-400 hover:text-slate-600">
                                      <Edit2 className="w-4 h-4" />
                                    </button>
                                    <button onClick={() => handleDeleteProduct(p.id)} className="p-2 hover:bg-red-50 rounded-lg transition-colors text-slate-400 hover:text-red-600">
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>

                        {/* Mobile Card List */}
                        <div className="md:hidden divide-y divide-border">
                          {filteredProducts.map(p => (
                            <div key={p.id} className="p-4 space-y-3">
                              <div className="flex justify-between items-start">
                                <span className="font-bold text-slate-700">{p.nome}</span>
                                <div className="flex gap-2">
                                  <button onClick={() => { setEditingProduct(p); setIsModalOpen(true); }} className="p-2 bg-slate-100 rounded-lg text-slate-600">
                                    <Edit2 className="w-4 h-4" />
                                  </button>
                                  <button onClick={() => handleDeleteProduct(p.id)} className="p-2 bg-red-50 rounded-lg text-red-600">
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              </div>
                              <div className="flex justify-between text-sm">
                                <div className="text-slate-500">
                                  Estoque: <span className="font-bold text-slate-700">{p.estoque_atual}</span>
                                </div>
                                <div className="text-slate-500">
                                  Preço: <span className="font-bold text-slate-700">R$ {p.valor_venda.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}

            {activeTab === 'entry' && (
              <motion.div key="entry" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-center py-4 lg:py-12">
                <div className="card w-full max-w-xl">
                  <div className="p-6 border-b border-border flex items-center gap-4">
                    <div className="p-3 bg-cyan-50 rounded-xl text-cyan-600"><ArrowDownLeft className="w-6 h-6" /></div>
                    <div>
                      <h3 className="text-xl font-bold text-slate-700">Registrar Entrada</h3>
                      <p className="text-sm text-slate-400">Adicione mercadoria ao estoque</p>
                    </div>
                  </div>
                  <form onSubmit={handleRegisterEntry} className="p-6 lg:p-8 space-y-6">
                    <div>
                      <label className="text-sm font-semibold text-slate-600 mb-2 block">Produto</label>
                      <select name="productId" required className="input">
                        <option value="">Selecione o produto</option>
                        {products.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
                      </select>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                      <div>
                        <label className="text-sm font-semibold text-slate-600 mb-2 block">Quantidade</label>
                        <input name="quantity" type="number" min="1" required className="input" placeholder="0" />
                      </div>
                      <div>
                        <label className="text-sm font-semibold text-slate-600 mb-2 block">Data da Entrada</label>
                        <div className="relative">
                          <Calendar className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
                          <input name="date" type="date" required defaultValue={new Date().toISOString().split('T')[0]} className="input" />
                        </div>
                      </div>
                    </div>
                    <div>
                      <label className="text-sm font-semibold text-slate-600 mb-2 block">Observação (opcional)</label>
                      <textarea name="note" className="input h-24 resize-none" placeholder="Ex: Compra do fornecedor X"></textarea>
                    </div>
                    <button type="submit" className="btn btn-primary w-full py-3 text-lg">
                      Registrar Entrada
                    </button>
                    <p className="text-center text-slate-400 text-xs">Cadastre produtos antes de registrar entradas</p>
                  </form>
                </div>
              </motion.div>
            )}

            {activeTab === 'conference' && (
              <motion.div key="conference" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div>
                    <h3 className="text-xl font-bold text-slate-700">Nova Conferência</h3>
                    <p className="text-sm text-slate-400">Compare o estoque físico com o sistema</p>
                  </div>
                  <button 
                    onClick={handleFinishAudit}
                    disabled={products.length === 0}
                    className="btn btn-primary w-full sm:w-auto"
                  >
                    <ClipboardCheck className="w-5 h-5" /> Finalizar Conferência
                  </button>
                </div>

                <div className="card">
                  {products.length === 0 ? (
                    <div className="p-20 text-center space-y-4">
                      <ClipboardCheck className="w-16 h-16 text-slate-200 mx-auto" />
                      <p className="text-slate-400">Cadastre produtos antes de fazer a conferência</p>
                    </div>
                  ) : (
                    <div className="block">
                      {/* Desktop Table */}
                      <div className="hidden md:block overflow-x-auto">
                        <table className="w-full">
                          <thead>
                            <tr>
                              <th className="table-header">Produto</th>
                              <th className="table-header">Estoque Anterior</th>
                              <th className="table-header">Estoque Contado</th>
                              <th className="table-header">Qtd. Saída</th>
                              <th className="table-header">Valor Vendido</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border">
                            {products.map(p => {
                              const counted = auditCounts[p.id] ?? p.estoque_atual;
                              const diff = p.estoque_atual - counted;
                              const val = diff > 0 ? diff * p.valor_venda : 0;
                              return (
                                <tr key={p.id} className="hover:bg-slate-50/50 transition-colors">
                                  <td className="table-cell font-bold">{p.nome}</td>
                                  <td className="table-cell font-medium text-slate-500">{p.estoque_atual}</td>
                                  <td className="table-cell">
                                    <input 
                                      type="number" 
                                      value={counted}
                                      className="input w-24 py-1"
                                      onChange={(e) => {
                                        const val = Number(e.target.value);
                                        setAuditCounts(prev => ({ ...prev, [p.id]: val }));
                                      }}
                                    />
                                  </td>
                                  <td className="table-cell">
                                    <span className={`font-bold ${diff > 0 ? 'text-cyan-600' : diff < 0 ? 'text-danger' : 'text-slate-400'}`}>
                                      {diff}
                                    </span>
                                  </td>
                                  <td className="table-cell font-bold text-slate-700">
                                    R$ {val.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>

                      {/* Mobile Card List */}
                      <div className="md:hidden divide-y divide-border">
                        {products.map(p => {
                          const counted = auditCounts[p.id] ?? p.estoque_atual;
                          const diff = p.estoque_atual - counted;
                          const val = diff > 0 ? diff * p.valor_venda : 0;
                          return (
                            <div key={p.id} className="p-4 space-y-4">
                              <div className="flex justify-between items-center">
                                <span className="font-bold text-slate-700">{p.nome}</span>
                                <span className="text-xs font-bold text-slate-400 uppercase">Anterior: {p.estoque_atual}</span>
                              </div>
                              <div className="flex items-center justify-between gap-4">
                                <div className="flex-1">
                                  <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Contagem Física</label>
                                  <input 
                                    type="number" 
                                    value={counted}
                                    className="input py-2"
                                    onChange={(e) => {
                                      const val = Number(e.target.value);
                                      setAuditCounts(prev => ({ ...prev, [p.id]: val }));
                                    }}
                                  />
                                </div>
                                <div className="text-right">
                                  <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Saída / Valor</label>
                                  <div className="flex flex-col items-end">
                                    <span className={`font-bold ${diff > 0 ? 'text-cyan-600' : diff < 0 ? 'text-danger' : 'text-slate-400'}`}>
                                      {diff > 0 ? `+${diff}` : diff} un
                                    </span>
                                    <span className="text-sm font-bold text-slate-700">
                                      R$ {val.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {activeTab === 'history_entries' && (
              <motion.div key="history_entries" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
                <div className="card">
                  {history.length === 0 ? (
                    <div className="p-20 text-center space-y-4">
                      <History className="w-16 h-16 text-slate-200 mx-auto" />
                      <p className="text-slate-400">Nenhuma entrada registrada</p>
                    </div>
                  ) : (
                    <div className="block">
                      {/* Desktop Table */}
                      <div className="hidden md:block overflow-x-auto">
                        <table className="w-full">
                          <thead>
                            <tr>
                              <th className="table-header">Data</th>
                              <th className="table-header">Produto</th>
                              <th className="table-header">Quantidade</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border">
                            {history.map(t => (
                              <tr key={t.id} className="hover:bg-slate-50/50 transition-colors">
                                <td className="table-cell text-xs text-slate-500">{new Date(t.created_at).toLocaleString('pt-BR')}</td>
                                <td className="table-cell font-bold">{t.produto?.nome}</td>
                                <td className="table-cell font-bold text-success">+{t.quantidade_entrada}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      {/* Mobile Card List */}
                      <div className="md:hidden divide-y divide-border">
                        {history.map(t => (
                          <div key={t.id} className="p-4 space-y-2">
                            <div className="flex justify-between items-start">
                              <span className="font-bold text-slate-700">{t.produto?.nome}</span>
                              <span className="text-xs text-slate-400">{new Date(t.created_at).toLocaleString('pt-BR')}</span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-sm font-bold text-success">+{t.quantidade_entrada} unidades</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {activeTab === 'history_conferences' && (
              <motion.div key="history_conferences" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
                <div className="card">
                  {audits.length === 0 ? (
                    <div className="p-20 text-center space-y-4">
                      <ClipboardCheck className="w-16 h-16 text-slate-200 mx-auto" />
                      <p className="text-slate-400">Nenhuma conferência registrada</p>
                    </div>
                  ) : (
                    <div className="block">
                      {/* Desktop Table */}
                      <div className="hidden md:block overflow-x-auto">
                        <table className="w-full">
                          <thead>
                            <tr>
                              <th className="table-header">Data</th>
                              <th className="table-header">Itens</th>
                              <th className="table-header">Total Vendido</th>
                              <th className="table-header text-right">Ações</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border">
                            {audits.map(a => (
                              <tr key={a.id} className="hover:bg-slate-50/50 transition-colors">
                                <td className="table-cell text-xs text-slate-500">{new Date(a.data_conferencia || a.created_at).toLocaleString('pt-BR')}</td>
                                <td className="table-cell">{a.items?.length || 0} produtos</td>
                                <td className="table-cell font-bold text-success">
                                  R$ {(a.total_vendido || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                </td>
                                <td className="table-cell text-right">
                                  <button 
                                    onClick={() => setViewingAudit(a)}
                                    className="btn btn-secondary py-1 px-3 text-xs"
                                  >
                                    <FileText className="w-4 h-4" /> Ver Comprovante
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      {/* Mobile Card List */}
                      <div className="md:hidden divide-y divide-border">
                        {audits.map(a => (
                          <div key={a.id} className="p-4 space-y-3">
                            <div className="flex justify-between items-start">
                              <div className="flex flex-col">
                                <span className="text-xs text-slate-400">{new Date(a.data_conferencia || a.created_at).toLocaleString('pt-BR')}</span>
                                <span className="font-bold text-slate-700">{a.items?.length || 0} produtos conferidos</span>
                              </div>
                              <span className="text-sm font-bold text-success">
                                R$ {(a.total_vendido || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                              </span>
                            </div>
                            <button 
                              onClick={() => setViewingAudit(a)}
                              className="btn btn-secondary w-full text-xs py-2"
                            >
                              <FileText className="w-4 h-4" /> Ver Comprovante
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {activeTab === 'reports' && (
              <motion.div key="reports" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center justify-center py-32 space-y-6">
                <BarChart3 className="w-20 h-20 text-slate-200" />
                <p className="text-slate-400">Módulo de relatórios em desenvolvimento</p>
              </motion.div>
            )}
          </AnimatePresence>
        )}
      </div>
    </main>

      {/* Product Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsModalOpen(false)} className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} className="card w-full max-w-lg relative z-10">
              <div className="p-6 border-b border-border flex items-center justify-between">
                <h3 className="text-xl font-bold text-slate-700">{editingProduct ? 'Editar Produto' : 'Novo Produto'}</h3>
                <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-slate-100 rounded-lg transition-colors"><X className="w-5 h-5" /></button>
              </div>
              <form onSubmit={handleSaveProduct} className="p-8 space-y-6">
                <div className="space-y-6">
                  <div>
                    <label className="text-sm font-semibold text-slate-600 mb-2 block">Nome do Produto</label>
                    <input name="name" defaultValue={editingProduct?.nome} required className="input" placeholder="Ex: Corona" />
                  </div>
                  <div>
                    <label className="text-sm font-semibold text-slate-600 mb-2 block">Quantidade</label>
                    <input name="quantity" type="number" defaultValue={editingProduct?.estoque_atual || 0} required className="input" />
                  </div>
                  <div>
                    <label className="text-sm font-semibold text-slate-600 mb-2 block">Preço de Venda (R$)</label>
                    <input name="price" type="number" step="0.01" defaultValue={editingProduct?.valor_venda || 0} required className="input" />
                  </div>
                </div>
                <div className="pt-4 flex gap-4">
                  <button type="button" onClick={() => setIsModalOpen(false)} className="btn btn-secondary flex-1">Cancelar</button>
                  <button type="submit" className="btn btn-primary flex-1">Salvar Produto</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Audit Detail Modal */}
      <AnimatePresence>
        {viewingAudit && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setViewingAudit(null)} className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} className="card w-full max-w-2xl relative z-10 max-h-[90vh] flex flex-col">
              <div className="p-6 border-b border-border flex items-center justify-between bg-slate-50 rounded-t-2xl">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white rounded-lg shadow-sm text-cyan-600">
                    <ClipboardCheck className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-slate-700">Comprovante de Conferência</h3>
                    <p className="text-xs text-slate-400">{new Date(viewingAudit.created_at).toLocaleString('pt-BR')}</p>
                  </div>
                </div>
                <button onClick={() => setViewingAudit(null)} className="p-2 hover:bg-slate-200 rounded-lg transition-colors"><X className="w-5 h-5" /></button>
              </div>
              
              <div className="flex-1 overflow-y-auto p-4 lg:p-6">
                <div className="space-y-6">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                      <p className="text-xs text-slate-400 uppercase font-bold tracking-wider mb-1">Total de Itens</p>
                      <p className="text-2xl font-bold text-slate-700">{viewingAudit.items?.length || 0}</p>
                    </div>
                    <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-100">
                      <p className="text-xs text-emerald-600 uppercase font-bold tracking-wider mb-1">Valor Total Vendido</p>
                      <p className="text-2xl font-bold text-emerald-700">
                        R$ {(viewingAudit.total_vendido || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                  </div>

                  <div className="border border-border rounded-xl overflow-hidden">
                    {/* Desktop Table */}
                    <table className="w-full text-sm hidden md:table">
                      <thead className="bg-slate-50">
                        <tr>
                          <th className="px-4 py-3 text-left font-bold text-slate-600">Produto</th>
                          <th className="px-4 py-3 text-center font-bold text-slate-600">Anterior</th>
                          <th className="px-4 py-3 text-center font-bold text-slate-600">Contado</th>
                          <th className="px-4 py-3 text-center font-bold text-slate-600">Saída</th>
                          <th className="px-4 py-3 text-right font-bold text-slate-600">Valor</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {viewingAudit.items?.map((item, idx) => (
                          <tr key={idx} className={item.quantidade_saida !== 0 ? 'bg-slate-50/30' : ''}>
                            <td className="px-4 py-3 font-medium text-slate-700">{item.produto?.nome}</td>
                            <td className="px-4 py-3 text-center text-slate-500">{item.estoque_anterior}</td>
                            <td className="px-4 py-3 text-center text-slate-500">{item.estoque_contado}</td>
                            <td className="px-4 py-3 text-center">
                              <span className={`font-bold ${item.quantidade_saida < 0 ? 'text-cyan-600' : item.quantidade_saida > 0 ? 'text-danger' : 'text-slate-300'}`}>
                                {item.quantidade_saida < 0 ? `+${Math.abs(item.quantidade_saida)}` : item.quantidade_saida > 0 ? `-${item.quantidade_saida}` : '0'}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right font-bold text-slate-700">
                              R$ {(item.valor_total || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>

                    {/* Mobile Card List */}
                    <div className="md:hidden divide-y divide-border">
                      {viewingAudit.items?.map((item, idx) => (
                        <div key={idx} className={`p-4 space-y-2 ${item.quantidade_saida !== 0 ? 'bg-slate-50/30' : ''}`}>
                          <div className="flex justify-between items-start">
                            <span className="font-bold text-slate-700">{item.produto?.nome}</span>
                            <span className="text-xs font-bold text-slate-700">R$ {(item.valor_total || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                          </div>
                          <div className="grid grid-cols-3 gap-2 text-[10px] font-bold text-slate-400 uppercase text-center">
                            <div>Ant: {item.estoque_anterior}</div>
                            <div>Cont: {item.estoque_contado}</div>
                            <div className={item.quantidade_saida < 0 ? 'text-cyan-600' : item.quantidade_saida > 0 ? 'text-danger' : ''}>
                              Saída: {item.quantidade_saida < 0 ? `+${Math.abs(item.quantidade_saida)}` : item.quantidade_saida > 0 ? `-${item.quantidade_saida}` : '0'}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-4 lg:p-6 border-t border-border bg-slate-50 rounded-b-2xl flex flex-col sm:flex-row gap-4">
                <button onClick={() => window.print()} className="btn btn-secondary flex-1">
                  <Download className="w-4 h-4" /> Imprimir / PDF
                </button>
                <button onClick={() => setViewingAudit(null)} className="btn btn-primary flex-1">
                  Fechar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Notifications */}
      <AnimatePresence>
        {notification && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className={`fixed bottom-6 right-6 z-[100] p-4 rounded-xl shadow-2xl flex items-center gap-3 border ${
              notification.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' :
              notification.type === 'error' ? 'bg-rose-50 border-rose-200 text-rose-800' :
              'bg-slate-50 border-slate-200 text-slate-800'
            }`}
          >
            {notification.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
            <span className="font-bold text-sm">{notification.message}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Confirmation Dialog */}
      <AnimatePresence>
        {confirmDialog && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
            >
              <div className="p-6 border-b border-border bg-slate-50">
                <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                  <AlertCircle className="w-6 h-6 text-amber-500" />
                  {confirmDialog.title}
                </h3>
              </div>
              <div className="p-6">
                <p className="text-slate-600 font-medium leading-relaxed">{confirmDialog.message}</p>
              </div>
              <div className="p-6 bg-slate-50 flex gap-4">
                <button 
                  onClick={() => setConfirmDialog(null)} 
                  className="btn btn-secondary flex-1"
                >
                  Cancelar
                </button>
                <button 
                  onClick={confirmDialog.onConfirm} 
                  className="btn btn-primary bg-danger hover:bg-danger/90 flex-1"
                >
                  Confirmar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

