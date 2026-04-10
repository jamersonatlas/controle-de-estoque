import React, { useState, useEffect, useMemo } from 'react';
import { 
  LayoutDashboard, Package, History, Plus, Search, ArrowUpRight, 
  ArrowDownLeft, AlertTriangle, Edit2, Trash2, X, Download, 
  TrendingUp, Box, DollarSign, ClipboardCheck, FileText, 
  LogOut, User, Lock, ArrowRight, TrendingDown, BarChart3, 
  Menu, CheckCircle2, AlertCircle, Eye, Calendar, Wallet
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Product, StockEntry, Conference, Tab, Expense } from './types';
import { db } from './lib/firebase';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, orderBy, writeBatch } from 'firebase/firestore';

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<Tab | 'expenses'>('dashboard');
  const [products, setProducts] = useState<Product[]>([]);
  const [history, setHistory] = useState<StockEntry[]>([]);
  const [audits, setAudits] = useState<Conference[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [auditCounts, setAuditCounts] = useState<Record<string, number>>({});
  const [viewingAudit, setViewingAudit] = useState<Conference | null>(null);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{ title: string; message: string; onConfirm: () => void } | null>(null);

  const showNotification = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4000);
  };

  useEffect(() => {
    const savedAuth = localStorage.getItem('estoqueapp_auth');
    if (savedAuth === 'true') {
      setIsAuthenticated(true);
      fetchData();
    } else { setLoading(false); }
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const pSnap = await getDocs(query(collection(db, 'produtos'), orderBy('nome')));
      const pData = pSnap.docs.map(d => ({ id: d.id, ...d.data() })) as Product[];
      
      const hSnap = await getDocs(query(collection(db, 'entradas_estoque'), orderBy('created_at', 'desc')));
      const hData = hSnap.docs.map(d => {
        const data = d.data();
        return { id: d.id, ...data, produto: pData.find(p => p.id === data.produto_id) };
      }) as StockEntry[];

      const cSnap = await getDocs(query(collection(db, 'conferencias'), orderBy('created_at', 'desc')));
      const iSnap = await getDocs(collection(db, 'conferencia_itens'));
      const allItems = iSnap.docs.map(d => ({ id: d.id, ...d.data() })) as any[];
      const cData = cSnap.docs.map(d => {
        const data = d.data();
        const items = allItems.filter(i => i.conferencia_id === d.id).map(i => ({ ...i, produto: pData.find(p => p.id === i.produto_id) }));
        return { id: d.id, ...data, items };
      }) as Conference[];

      const eSnap = await getDocs(query(collection(db, 'despesas'), orderBy('data', 'desc')));
      const eData = eSnap.docs.map(d => ({ id: d.id, ...d.data() })) as Expense[];

      setProducts(pData);
      setHistory(hData);
      setAudits(cData);
      setExpenses(eData);
    } catch (error) { console.error(error); } finally { setLoading(false); }
  };

  const handleLogin = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const user = formData.get('user') as string;
    const pass = formData.get('pass') as string;
    if (user.length >= 4 && pass.length >= 4) {
      setIsAuthenticated(true);
      localStorage.setItem('estoqueapp_auth', 'true');
      fetchData();
    } else { showNotification('Mínimo 4 caracteres', 'error'); }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    localStorage.removeItem('estoqueapp_auth');
  };

  const handleAddExpense = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    try {
      await addDoc(collection(db, 'despesas'), {
        descricao: formData.get('descricao'),
        valor: Number(formData.get('valor')),
        categoria: formData.get('categoria'),
        data: formData.get('data'),
        created_at: new Date().toISOString()
      });
      fetchData();
      showNotification('Despesa registrada!', 'success');
      (e.target as HTMLFormElement).reset();
    } catch (error) { showNotification('Erro ao registrar despesa.', 'error'); }
  };

  const handleFinishAudit = async () => {
    setConfirmDialog({
      title: 'Finalizar Conferência',
      message: 'Deseja atualizar o estoque e gerar venda?',
      onConfirm: async () => {
        setConfirmDialog(null);
        setLoading(true);
        try {
          const batch = writeBatch(db);
          const confRef = doc(collection(db, 'conferencias'));
          let total = 0;
          products.forEach(p => {
            const contado = auditCounts[p.id] ?? p.estoque_atual;
            const saida = p.estoque_atual - contado;
            const val = saida > 0 ? saida * p.valor_venda : 0;
            if (saida > 0) total += val;
            batch.set(doc(collection(db, 'conferencia_itens')), { conferencia_id: confRef.id, produto_id: p.id, estoque_anterior: p.estoque_atual, estoque_contado: contado, quantidade_saida: saida, valor_unitario: p.valor_venda, valor_total: val });
            batch.update(doc(db, 'produtos', p.id), { estoque_atual: contado });
          });
          batch.set(confRef, { data_conferencia: new Date().toISOString(), total_vendido: total, created_at: new Date().toISOString() });
          await batch.commit();
          fetchData();
          setAuditCounts({});
          setActiveTab('history_conferences');
          showNotification('Conferência finalizada!', 'success');
        } catch (e) { showNotification('Erro ao salvar.', 'error'); }
        finally { setLoading(false); }
      }
    });
  };

  const lowStockProducts = useMemo(() => products.filter(p => p.estoque_atual <= 5), [products]);
  
  const stats = useMemo(() => {
    const totalItens = products.reduce((acc, p) => acc + p.estoque_atual, 0);
    const valorEstoque = products.reduce((acc, p) => acc + (p.estoque_atual * p.valor_venda), 0);
    const totalVendas = audits.reduce((acc, a) => acc + (a.total_vendido || 0), 0);
    const totalDespesas = expenses.reduce((acc, e) => acc + (e.valor || 0), 0);
    return { totalItens, valorEstoque, totalVendas, totalDespesas, saldo: totalVendas - totalDespesas };
  }, [products, audits, expenses]);

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center p-4 text-center">
        <div className="w-full max-w-md card p-8 shadow-2xl">
          <h1 className="text-3xl font-black mb-2 text-slate-800 tracking-tight italic">MARIA LANCHES</h1>
          <p className="text-slate-400 mb-8 font-medium italic">Sistema de Gestão</p>
          <form onSubmit={handleLogin} className="space-y-6 text-left">
            <div><label className="label">Usuário</label><input name="user" required className="input" /></div>
            <div><label className="label">Senha</label><input name="pass" type="password" required className="input" /></div>
            <button type="submit" className="btn btn-primary w-full py-3">Entrar</button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-bg overflow-hidden">
      <AnimatePresence>{isMobileMenuOpen && ( <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsMobileMenuOpen(false)} className="fixed inset-0 bg-slate-900/60 z-30 lg:hidden" /> )}</AnimatePresence>
      <aside className={`fixed inset-y-0 left-0 w-64 bg-sidebar flex flex-col shadow-xl z-40 transition-transform duration-300 lg:relative lg:translate-x-0 ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="p-6 flex items-center gap-3">
          <div className="w-10 h-10 bg-warning rounded-lg flex items-center justify-center shadow-md"><TrendingUp className="text-white w-6 h-6" /></div>
          <div><h1 className="font-bold text-white tracking-tight text-lg italic">Maria Lanches</h1></div>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          <button onClick={() => {setActiveTab('dashboard'); setIsMobileMenuOpen(false);}} className={`sidebar-item ${activeTab === 'dashboard' ? 'sidebar-item-active' : ''}`}><LayoutDashboard className="w-5 h-5" /> Dashboard</button>
          <button onClick={() => {setActiveTab('expenses'); setIsMobileMenuOpen(false);}} className={`sidebar-item ${activeTab === 'expenses' ? 'sidebar-item-active' : ''}`}><Wallet className="w-5 h-5" /> Financeiro</button>
          <button onClick={() => {setActiveTab('products'); setIsMobileMenuOpen(false);}} className={`sidebar-item ${activeTab === 'products' ? 'sidebar-item-active' : ''}`}><Package className="w-5 h-5" /> Produtos</button>
          <button onClick={() => {setActiveTab('entry'); setIsMobileMenuOpen(false);}} className={`sidebar-item ${activeTab === 'entry' ? 'sidebar-item-active' : ''}`}><ArrowDownLeft className="w-5 h-5" /> Entrada</button>
          <button onClick={() => {setActiveTab('conference'); setIsMobileMenuOpen(false);}} className={`sidebar-item ${activeTab === 'conference' ? 'sidebar-item-active' : ''}`}><ClipboardCheck className="w-5 h-5" /> Conferência</button>
          <div className="pt-6 pb-2 px-4"><p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Relatórios</p></div>
          <button onClick={() => {setActiveTab('history_entries'); setIsMobileMenuOpen(false);}} className={`sidebar-item ${activeTab === 'history_entries' ? 'sidebar-item-active' : ''}`}><History className="w-5 h-5" /> Hist. Entradas</button>
          <button onClick={() => {setActiveTab('history_conferences'); setIsMobileMenuOpen(false);}} className={`sidebar-item ${activeTab === 'history_conferences' ? 'sidebar-item-active' : ''}`}><History className="w-5 h-5" /> Hist. Vendas</button>
        </nav>
        <div className="p-4 border-t border-slate-700"><button onClick={handleLogout} className="sidebar-item text-slate-400"><LogOut className="w-5 h-5" /> Sair</button></div>
      </aside>

      <main className="flex-1 flex flex-col overflow-hidden w-full">
        <header className="h-16 border-b bg-surface flex items-center px-4 lg:px-8 justify-between shadow-sm">
          <button onClick={() => setIsMobileMenuOpen(true)} className="lg:hidden p-2 text-slate-600"><Menu/></button>
          <h2 className="text-lg font-semibold text-slate-700 capitalize">{activeTab.replace('_', ' ')}</h2>
          <div className="w-6 lg:hidden" />
        </header>

        <div className="flex-1 overflow-y-auto p-4 lg:p-8">
          {loading ? <div className="flex items-center justify-center h-full"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-sidebar"></div></div> : (
            <AnimatePresence mode="wait">
              {activeTab === 'dashboard' && (
                <motion.div key="db" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">
                  {lowStockProducts.length > 0 && (
                    <div className="bg-rose-50 border-2 border-rose-100 p-4 rounded-2xl flex items-center gap-4">
                      <div className="p-2 bg-rose-500 text-white rounded-lg animate-pulse"><AlertTriangle /></div>
                      <div><p className="text-rose-800 font-bold">Estoque Baixo!</p><p className="text-rose-600 text-sm">Repor: {lowStockProducts.map(p => p.nome).join(', ')}</p></div>
                    </div>
                  )}
                  
                  {/* TODOS OS CARDS JUNTOS (OS 3 ANTIGOS + FINANCEIRO) */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
                    <div className="card p-5 border-l-4 border-slate-800 shadow-sm"><p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Produtos</p><p className="text-xl font-bold">{products.length}</p></div>
                    <div className="card p-5 border-l-4 border-blue-500 shadow-sm"><p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Itens Estoque</p><p className="text-xl font-bold">{stats.totalItens}</p></div>
                    <div className="card p-5 border-l-4 border-cyan-500 shadow-sm"><p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Valor Estoque</p><p className="text-xl font-bold">R$ {stats.valorEstoque.toLocaleString('pt-BR')}</p></div>
                    <div className="card p-5 border-l-4 border-green-500 shadow-sm"><p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Vendas (Total)</p><p className="text-xl font-bold text-green-600">R$ {stats.totalVendas.toLocaleString('pt-BR')}</p></div>
                    <div className="card p-5 border-l-4 border-rose-500 shadow-sm"><p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Despesas (Total)</p><p className="text-xl font-bold text-rose-600">R$ {stats.totalDespesas.toLocaleString('pt-BR')}</p></div>
                  </div>

                  <div className="card"><div className="p-6 border-b font-bold text-slate-700">Tabela de Estoque Atual</div>
                    <div className="overflow-x-auto"><table className="w-full text-left">
                      <thead><tr className="bg-slate-50 text-xs font-bold text-slate-500 uppercase"><th className="p-4">Produto</th><th className="p-4 text-center">Qtd</th><th className="p-4 text-right">Valor em Mãos</th></tr></thead>
                      <tbody className="divide-y">{products.map(p => (
                        <tr key={p.id} className="hover:bg-slate-50">
                          <td className="p-4 font-medium text-slate-700">{p.nome}</td>
                          <td className={`p-4 text-center font-bold ${p.estoque_atual <= 5 ? 'text-danger animate-pulse' : 'text-slate-600'}`}>{p.estoque_atual}</td>
                          <td className="p-4 text-right font-bold text-slate-700">R$ {(p.estoque_atual * p.valor_venda).toLocaleString('pt-BR')}</td>
                        </tr>
                      ))}</tbody>
                    </table></div>
                  </div>
                </motion.div>
              )}

              {/* ABA FINANCEIRO */}
              {activeTab === 'expenses' && (
                <div className="space-y-8">
                  <div className="card p-8 max-w-2xl mx-auto shadow-lg border-t-4 border-rose-500">
                    <h3 className="text-xl font-bold mb-6 text-slate-700">Registrar Gasto (Saída)</h3>
                    <form onSubmit={handleAddExpense} className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="md:col-span-2"><label className="label">Descrição</label><input name="descricao" required className="input" placeholder="Ex: Gelo, Luz, Aluguel..." /></div>
                      <div><label className="label">Valor (R$)</label><input name="valor" type="number" step="0.01" required className="input" placeholder="0,00" /></div>
                      <div><label className="label">Data</label><input name="data" type="date" required defaultValue={new Date().toISOString().split('T')[0]} className="input" /></div>
                      <div className="md:col-span-2"><label className="label">Categoria</label><select name="categoria" className="input"><option>Mercadoria</option><option>Infraestrutura</option><option>Pessoal</option><option>Outros</option></select></div>
                      <button className="md:col-span-2 btn btn-primary py-3 bg-rose-600 hover:bg-rose-700 border-none">Salvar Despesa</button>
                    </form>
                  </div>
                  <div className="card"><div className="p-6 border-b font-bold text-slate-700">Últimos Gastos</div>
                    <div className="overflow-x-auto"><table className="w-full text-left text-sm">
                      <thead><tr className="bg-slate-50 text-xs font-bold uppercase text-slate-500"><th className="p-4">Data</th><th className="p-4">Descrição</th><th className="p-4 text-right">Valor</th></tr></thead>
                      <tbody className="divide-y">{expenses.map(e => (
                        <tr key={e.id} className="hover:bg-slate-50"><td className="p-4">{new Date(e.data).toLocaleDateString('pt-BR')}</td><td className="p-4 font-bold">{e.descricao}</td><td className="p-4 text-right font-bold text-rose-600">R$ {e.valor.toLocaleString('pt-BR')}</td></tr>
                      ))}</tbody>
                    </table></div>
                  </div>
                </div>
              )}

              {/* HISTÓRICO DE ENTRADAS (RESTAURADO) */}
              {activeTab === 'history_entries' && (
                <div className="card"><div className="p-6 border-b font-bold text-slate-700">Relatório de Entradas</div>
                  <div className="overflow-x-auto"><table className="w-full text-left">
                    <thead><tr className="bg-slate-50 text-xs font-bold uppercase text-slate-500"><th className="p-4">Data</th><th className="p-4">Produto</th><th className="p-4 text-center">Quantidade</th></tr></thead>
                    <tbody className="divide-y">{history.map(h => (
                      <tr key={h.id} className="hover:bg-slate-50"><td className="p-4">{new Date(h.data_entrada).toLocaleDateString('pt-BR')}</td><td className="p-4 font-medium">{h.produto?.nome || 'Excluído'}</td><td className="p-4 text-center font-bold text-green-600">+{h.quantidade_entrada}</td></tr>
                    ))}</tbody>
                  </table></div>
                </div>
              )}

              {/* OUTRAS ABAS MANTIDAS IGUAIS */}
              {activeTab === 'products' && (
                <div className="space-y-6">
                  <div className="flex justify-between items-center"><input className="input w-64" placeholder="Buscar..." onChange={e => setSearchTerm(e.target.value)}/><button onClick={() => { setEditingProduct(null); setIsModalOpen(true); }} className="btn btn-primary">Novo Produto</button></div>
                  <div className="card divide-y">{products.filter(p => p.nome.toLowerCase().includes(searchTerm.toLowerCase())).map(p => (
                      <div key={p.id} className="p-4 flex justify-between items-center hover:bg-slate-50">
                        <div><p className="font-bold">{p.nome}</p><p className="text-xs text-slate-500">Preço: R$ {p.valor_venda.toLocaleString('pt-BR')}</p></div>
                        <div className="flex gap-2"><button onClick={() => { setEditingProduct(p); setIsModalOpen(true); }} className="p-2 bg-slate-100 rounded-lg"><Edit2 className="w-4 h-4"/></button></div>
                      </div>
                    ))}</div>
                </div>
              )}
              {activeTab === 'entry' && (
                <div className="flex justify-center py-10"><div className="card w-full max-w-lg p-8 shadow-lg">
                  <h3 className="text-xl font-bold mb-6 text-slate-700 border-b pb-4">Entrada de Estoque</h3>
                  <form onSubmit={async (e) => {
                    e.preventDefault(); const formData = new FormData(e.currentTarget); const p_id = formData.get('productId') as string; const qtd = Number(formData.get('quantity')); const p = products.find(prod => prod.id === p_id); if (!p) return;
                    const batch = writeBatch(db); batch.set(doc(collection(db, 'entradas_estoque')), { produto_id: p_id, quantidade_entrada: qtd, data_entrada: formData.get('date'), created_at: new Date().toISOString() });
                    batch.update(doc(db, 'produtos', p_id), { estoque_atual: p.estoque_atual + qtd });
                    await batch.commit(); fetchData(); setActiveTab('dashboard');
                  }} className="space-y-4">
                    <div><label className="label">Produto</label><select name="productId" required className="input"><option value="">Selecione</option>{products.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}</select></div>
                    <div><label className="label">Quantidade</label><input name="quantity" type="number" required className="input"/></div>
                    <div><label className="label">Data</label><input name="date" type="date" required defaultValue={new Date().toISOString().split('T')[0]} className="input"/></div>
                    <button className="btn btn-primary w-full py-3">Salvar Entrada</button>
                  </form>
                </div></div>
              )}
              {activeTab === 'conference' && (
                <div className="space-y-6">
                  <div className="flex justify-between items-center"><div><h3 className="font-bold text-slate-700 text-xl">Conferência Física</h3><p className="text-sm text-slate-400">Digite a contagem real</p></div><button onClick={handleFinishAudit} className="btn btn-primary px-10">Finalizar</button></div>
                  <div className="card divide-y">{products.map(p => (
                    <div key={p.id} className="p-4 flex justify-between items-center hover:bg-slate-50">
                      <span className="font-bold">{p.nome}</span>
                      <div className="flex items-center gap-3"><span className="text-xs text-slate-400">Sistema: {p.estoque_atual}</span><input type="number" className="input w-24 text-center" placeholder="Real" onChange={e => setAuditCounts(prev => ({...prev, [p.id]: Number(e.target.value)}))}/></div>
                    </div>
                  ))}</div>
                </div>
              )}
              {activeTab === 'history_conferences' && (
                <div className="space-y-4">
                  {audits.map(audit => (
                    <div key={audit.id} className="card p-5 flex items-center justify-between">
                      <div><div className="flex items-center gap-2 text-slate-400 text-sm mb-1"><Calendar className="w-4 h-4" /> {new Date(audit.data_conferencia).toLocaleString('pt-BR')}</div>
                      <div className="font-bold text-slate-700 text-lg">Faturamento: <span className="text-green-600">R$ {audit.total_vendido.toLocaleString('pt-BR')}</span></div></div>
                      <button onClick={() => setViewingAudit(audit)} className="btn btn-secondary px-6 flex items-center gap-2"><Eye className="w-4 h-4" /> Detalhes</button>
                    </div>
                  ))}
                </div>
              )}
            </AnimatePresence>
          )}
        </div>
      </main>

      {/* COMPROVANTE */}
      <AnimatePresence>{viewingAudit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm">
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-white rounded-2xl w-full max-w-2xl p-8 shadow-2xl relative">
            <button onClick={() => setViewingAudit(null)} className="absolute top-4 right-4 p-2 text-slate-400 hover:bg-slate-100 rounded-full"><X /></button>
            <div className="text-center mb-8 border-b pb-6"><h3 className="text-2xl font-bold text-slate-800 italic uppercase">MARIA LANCHES</h3><p className="text-slate-400 font-medium">Comprovante de Venda - {new Date(viewingAudit.data_conferencia).toLocaleString('pt-BR')}</p></div>
            <div className="space-y-4 max-h-[350px] overflow-y-auto px-2">
              <table className="w-full text-sm">
                <thead><tr className="text-slate-400 uppercase text-[10px] font-black border-b"><th className="pb-2 text-left">Item</th><th className="pb-2 text-center">Saída</th><th className="pb-2 text-right">Total</th></tr></thead>
                <tbody className="divide-y">{viewingAudit.items?.filter(i => i.quantidade_saida > 0).map((item, idx) => (
                    <tr key={idx} className="hover:bg-slate-50">
                      <td className="py-3 font-bold text-slate-700">{item.produto?.nome || 'Excluído'}</td>
                      <td className="py-3 text-center font-black text-rose-500">{item.quantidade_saida}</td>
                      <td className="py-3 text-right font-black text-slate-800">R$ {item.valor_total.toLocaleString('pt-BR')}</td>
                    </tr>
                  ))}</tbody>
              </table>
            </div>
            <div className="mt-8 pt-6 border-t border-dashed flex justify-between items-center"><div className="text-slate-400 font-bold uppercase text-xs">Total Vendido</div><p className="text-4xl font-black text-green-600">R$ {viewingAudit.total_vendido.toLocaleString('pt-BR')}</p></div>
          </motion.div>
        </div>
      )}</AnimatePresence>

      {/* MODAL EDITAR PRODUTO */}
      <AnimatePresence>{isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40">
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="card w-full max-w-md p-8">
            <h3 className="text-xl font-bold mb-6 text-slate-700">{editingProduct ? 'Editar' : 'Novo'} Produto</h3>
            <form onSubmit={async (e) => {
              e.preventDefault(); const formData = new FormData(e.currentTarget); const nome = formData.get('name') as string; const estoque_atual = Number(formData.get('quantity')); const valor_venda = Number(formData.get('price'));
              if (editingProduct) { await updateDoc(doc(db, 'produtos', editingProduct.id), { nome, estoque_atual, valor_venda }); }
              else { await addDoc(collection(db, 'produtos'), { nome, estoque_atual, valor_venda, created_at: new Date().toISOString() }); }
              fetchData(); setIsModalOpen(false); setEditingProduct(null);
            }} className="space-y-4">
              <input name="name" defaultValue={editingProduct?.nome} placeholder="Nome" required className="input"/>
              <div className="grid grid-cols-2 gap-4"><input name="quantity" type="number" defaultValue={editingProduct?.estoque_atual} placeholder="Qtd" required className="input"/><input name="price" type="number" step="0.01" defaultValue={editingProduct?.valor_venda} placeholder="Preço" required className="input"/></div>
              <div className="flex gap-3 pt-2"><button type="button" onClick={() => setIsModalOpen(false)} className="btn btn-secondary flex-1">Cancelar</button><button type="submit" className="btn btn-primary flex-1">Salvar</button></div>
            </form>
          </motion.div>
        </div>
      )}</AnimatePresence>

      {/* MODAL CONFIRMAÇÃO */}
      <AnimatePresence>{confirmDialog && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60"><div className="bg-white p-6 rounded-2xl max-w-sm w-full shadow-2xl"><h3 className="font-bold text-lg mb-4 text-slate-800">{confirmDialog.message}</h3><div className="flex gap-3"><button onClick={() => setConfirmDialog(null)} className="btn btn-secondary flex-1">Não</button><button onClick={confirmDialog.onConfirm} className="btn btn-primary bg-danger flex-1">Sim</button></div></div></div>
      )}</AnimatePresence>

      <AnimatePresence>{notification && ( <motion.div initial={{ opacity: 0, y: 50 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 50 }} className={`fixed bottom-6 right-6 p-4 rounded-xl border-2 z-[100] shadow-xl flex items-center gap-3 ${notification.type === 'error' ? 'bg-rose-50 border-rose-200 text-rose-800' : 'bg-emerald-50 border-emerald-200 text-emerald-800'}`}><span className="font-bold">{notification.message}</span></motion.div> )}</AnimatePresence>
    </div>
  );
}
