import React, { useState, useEffect, useMemo } from 'react';
import { 
  LayoutDashboard, Package, History, Plus, Search, ArrowUpRight, 
  ArrowDownLeft, AlertTriangle, Edit2, Trash2, X, Download, 
  TrendingUp, Box, DollarSign, ClipboardCheck, FileText, 
  LogOut, User, Lock, ArrowRight, TrendingDown, BarChart3, 
  Menu, CheckCircle2, AlertCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Product, StockEntry, Conference, Tab } from './types';
import { db } from './lib/firebase';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, orderBy, writeBatch } from 'firebase/firestore';

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
    } else {
      setLoading(false);
    }
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
        const items = allItems
          .filter(i => i.conferencia_id === d.id)
          .map(i => ({ ...i, produto: pData.find(p => p.id === i.produto_id) }));
        return { id: d.id, ...data, items };
      }) as Conference[];
      setProducts(pData);
      setHistory(hData);
      setAudits(cData);
    } catch (error) {
      console.error(error);
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
      fetchData();
    } else {
      showNotification('Mínimo 4 caracteres', 'error');
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    localStorage.removeItem('estoqueapp_auth');
  };

  const handleSaveProduct = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const nome = formData.get('name') as string;
    const estoque_atual = Number(formData.get('quantity'));
    const valor_venda = Number(formData.get('price'));
    try {
      if (editingProduct) {
        await updateDoc(doc(db, 'produtos', editingProduct.id), { nome, estoque_atual, valor_venda });
      } else {
        await addDoc(collection(db, 'produtos'), { nome, estoque_atual, valor_venda, created_at: new Date().toISOString() });
      }
      fetchData();
      setIsModalOpen(false);
      setEditingProduct(null);
      showNotification('Produto salvo!', 'success');
    } catch (e) { showNotification('Erro ao salvar.', 'error'); }
  };

  const handleDeleteProduct = async (id: string) => {
    setConfirmDialog({
      title: 'Excluir Produto',
      message: 'Tem certeza que deseja excluir? Esta ação não pode ser desfeita.',
      onConfirm: async () => {
        setConfirmDialog(null);
        await deleteDoc(doc(db, 'produtos', id));
        fetchData();
        showNotification('Excluído com sucesso');
      }
    });
  };

  const handleRegisterEntry = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const p_id = formData.get('productId') as string;
    const qtd = Number(formData.get('quantity'));
    const p = products.find(prod => prod.id === p_id);
    if (!p) return;
    try {
      const batch = writeBatch(db);
      batch.set(doc(collection(db, 'entradas_estoque')), { produto_id: p_id, quantidade_entrada: qtd, data_entrada: formData.get('date'), created_at: new Date().toISOString() });
      batch.update(doc(db, 'produtos', p_id), { estoque_atual: p.estoque_atual + qtd });
      await batch.commit();
      fetchData();
      setActiveTab('history_entries');
      showNotification('Entrada registrada!', 'success');
    } catch (e) { showNotification('Erro ao registrar entrada.', 'error'); }
  };

  const handleFinishAudit = async () => {
    setConfirmDialog({
      title: 'Finalizar Conferência',
      message: 'Deseja atualizar o estoque conforme a contagem física?',
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
        } catch (e) { showNotification('Erro ao finalizar.', 'error'); }
        finally { setLoading(false); }
      }
    });
  };

  const stats = useMemo(() => {
    const totalItems = products.reduce((acc, p) => acc + p.estoque_atual, 0);
    const totalValue = products.reduce((acc, p) => acc + (p.estoque_atual * p.valor_venda), 0);
    return { totalItems, totalValue };
  }, [products]);

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center p-4">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-sidebar rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
              <TrendingUp className="text-white w-10 h-10" />
            </div>
            <h1 className="text-3xl font-bold text-slate-800">EstoqueApp</h1>
            <p className="text-slate-500">Acesse com qualquer login e senha</p>
          </div>
          <div className="card p-8 shadow-xl">
            <form onSubmit={handleLogin} className="space-y-6">
              <div>
                <label className="text-sm font-semibold text-slate-600 mb-2 block">Usuário</label>
                <div className="relative"><User className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input name="user" required className="input pl-11" placeholder="Seu usuário" /></div>
              </div>
              <div>
                <label className="text-sm font-semibold text-slate-600 mb-2 block">Senha</label>
                <div className="relative"><Lock className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input name="pass" type="password" required className="input pl-11" placeholder="••••••" /></div>
              </div>
              <button type="submit" className="btn btn-primary w-full py-3 text-lg">Entrar <ArrowRight className="w-5 h-5 ml-2" /></button>
            </form>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-bg overflow-hidden">
      {/* Sidebar - O design azul escuro de volta */}
      <aside className={`fixed inset-y-0 left-0 w-64 bg-sidebar flex flex-col shadow-xl z-40 transition-transform duration-300 lg:relative lg:translate-x-0 ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="p-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-warning rounded-lg flex items-center justify-center shadow-md"><TrendingUp className="text-white w-6 h-6" /></div>
            <div><h1 className="font-bold text-white tracking-tight">EstoqueApp</h1><p className="text-[10px] text-slate-400 uppercase font-bold">Controle de Bebidas</p></div>
          </div>
          <button onClick={() => setIsMobileMenuOpen(false)} className="lg:hidden text-slate-400"><X /></button>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          <button onClick={() => {setActiveTab('dashboard'); setIsMobileMenuOpen(false);}} className={`sidebar-item ${activeTab === 'dashboard' ? 'sidebar-item-active' : ''}`}><LayoutDashboard className="w-5 h-5" /> Dashboard</button>
          <button onClick={() => {setActiveTab('products'); setIsMobileMenuOpen(false);}} className={`sidebar-item ${activeTab === 'products' ? 'sidebar-item-active' : ''}`}><Package className="w-5 h-5" /> Produtos</button>
          <button onClick={() => {setActiveTab('entry'); setIsMobileMenuOpen(false);}} className={`sidebar-item ${activeTab === 'entry' ? 'sidebar-item-active' : ''}`}><ArrowDownLeft className="w-5 h-5" /> Entrada</button>
          <button onClick={() => {setActiveTab('conference'); setIsMobileMenuOpen(false);}} className={`sidebar-item ${activeTab === 'conference' ? 'sidebar-item-active' : ''}`}><ClipboardCheck className="w-5 h-5" /> Conferência</button>
          <div className="pt-4 pb-2 px-4"><p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Histórico</p></div>
          <button onClick={() => {setActiveTab('history_entries'); setIsMobileMenuOpen(false);}} className={`sidebar-item ${activeTab === 'history_entries' ? 'sidebar-item-active' : ''}`}><History className="w-5 h-5" /> Hist. Entradas</button>
          <button onClick={() => {setActiveTab('history_conferences'); setIsMobileMenuOpen(false);}} className={`sidebar-item ${activeTab === 'history_conferences' ? 'sidebar-item-active' : ''}`}><History className="w-5 h-5" /> Hist. Conferências</button>
        </nav>
        <div className="p-4 border-t border-slate-700"><button onClick={handleLogout} className="sidebar-item text-slate-400 hover:text-white"><LogOut className="w-5 h-5" /> Sair</button></div>
      </aside>

      <main className="flex-1 flex flex-col overflow-hidden w-full">
        <header className="h-16 border-b border-border bg-surface flex items-center px-4 lg:px-8 shadow-sm z-10 justify-between">
          <button onClick={() => setIsMobileMenuOpen(true)} className="lg:hidden p-2 text-slate-600 hover:bg-slate-100 rounded-lg"><Menu /></button>
          <h2 className="text-lg font-semibold text-slate-700 capitalize">{activeTab.replace('_', ' ')}</h2>
          <div className="w-10 lg:hidden" />
        </header>

        <div className="flex-1 overflow-y-auto p-4 lg:p-8">
          {loading ? (
            <div className="flex items-center justify-center h-full"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-sidebar"></div></div>
          ) : (
            <AnimatePresence mode="wait">
              {activeTab === 'dashboard' && (
                <motion.div key="db" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <div className="card p-6 flex items-center gap-4"><div className="p-3 bg-blue-50 rounded-xl text-blue-600"><Package className="w-6 h-6" /></div><div><p className="text-xs font-bold text-slate-400 uppercase">Produtos</p><p className="text-2xl font-bold">{products.length}</p></div></div>
                    <div className="card p-6 flex items-center gap-4"><div className="p-3 bg-cyan-50 rounded-xl text-cyan-600"><Box className="w-6 h-6" /></div><div><p className="text-xs font-bold text-slate-400 uppercase">Itens em Estoque</p><p className="text-2xl font-bold">{stats.totalItems}</p></div></div>
                    <div className="card p-6 flex items-center gap-4"><div className="p-3 bg-green-50 rounded-xl text-green-600"><DollarSign className="w-6 h-6" /></div><div><p className="text-xs font-bold text-slate-400 uppercase">Valor do Estoque</p><p className="text-2xl font-bold">R$ {stats.totalValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p></div></div>
                  </div>
                  <div className="card"><div className="p-6 border-b border-border font-bold text-slate-700">Posição Atual de Estoque</div>
                    <div className="overflow-x-auto"><table className="w-full">
                      <thead><tr className="bg-slate-50"><th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase">Produto</th><th className="px-6 py-3 text-center text-xs font-bold text-slate-500 uppercase">Qtd</th><th className="px-6 py-3 text-right text-xs font-bold text-slate-500 uppercase">Valor Total</th></tr></thead>
                      <tbody className="divide-y divide-border">{products.map(p => (
                        <tr key={p.id} className="hover:bg-slate-50/50">
                          <td className="px-6 py-4 font-medium text-slate-700">{p.nome}</td>
                          <td className={`px-6 py-4 text-center font-bold ${p.estoque_atual <= 5 ? 'text-danger' : 'text-slate-600'}`}>{p.estoque_atual}</td>
                          <td className="px-6 py-4 text-right font-bold text-slate-700">R$ {(p.estoque_atual * p.valor_venda).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                        </tr>
                      ))}</tbody>
                    </table></div>
                  </div>
                </motion.div>
              )}
              {activeTab === 'products' && (
                <motion.div key="prod" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="relative w-full sm:w-96"><Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input type="text" placeholder="Buscar produto..." className="input pl-10" onChange={e => setSearchTerm(e.target.value)} /></div>
                    <button onClick={() => { setEditingProduct(null); setIsModalOpen(true); }} className="btn btn-primary w-full sm:w-auto"><Plus className="w-5 h-5" /> Novo Produto</button>
                  </div>
                  <div className="card divide-y divide-border">
                    {products.filter(p => p.nome.toLowerCase().includes(searchTerm.toLowerCase())).map(p => (
                      <div key={p.id} className="p-4 flex items-center justify-between hover:bg-slate-50">
                        <div><p className="font-bold text-slate-700">{p.nome}</p><p className="text-sm text-slate-400">Preço: R$ {p.valor_venda.toLocaleString('pt-BR')}</p></div>
                        <div className="flex gap-2"><button onClick={() => { setEditingProduct(p); setIsModalOpen(true); }} className="p-2 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600"><Edit2 className="w-4 h-4"/></button><button onClick={() => handleDeleteProduct(p.id)} className="p-2 hover:bg-red-50 rounded-lg text-slate-400 hover:text-red-600"><Trash2 className="w-4 h-4"/></button></div>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
              {activeTab === 'entry' && (
                <motion.div key="ent" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-center py-12">
                  <div className="card w-full max-w-xl p-8 shadow-lg">
                    <div className="flex items-center gap-4 mb-8"><div className="p-3 bg-cyan-50 rounded-xl text-cyan-600"><ArrowDownLeft className="w-6 h-6" /></div><h3 className="text-xl font-bold text-slate-700">Registrar Entrada</h3></div>
                    <form onSubmit={handleRegisterEntry} className="space-y-6">
                      <div><label className="label">Produto</label><select name="productId" required className="input"><option value="">Selecione o produto</option>{products.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}</select></div>
                      <div className="grid grid-cols-2 gap-6"><div><label className="label">Quantidade</label><input name="quantity" type="number" min="1" required className="input" /></div><div><label className="label">Data</label><input name="date" type="date" required defaultValue={new Date().toISOString().split('T')[0]} className="input" /></div></div>
                      <button type="submit" className="btn btn-primary w-full py-3">Registrar Entrada</button>
                    </form>
                  </div>
                </motion.div>
              )}
              {activeTab === 'conference' && (
                <motion.div key="conf" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
                  <div className="flex items-center justify-between"><div><h3 className="text-xl font-bold text-slate-700">Conferência Física</h3><p className="text-sm text-slate-400">Conte os itens e digite a quantidade real</p></div><button onClick={handleFinishAudit} className="btn btn-primary px-6">Finalizar Conferência</button></div>
                  <div className="card overflow-hidden"><table className="w-full">
                    <thead className="bg-slate-50"><tr className="text-left"><th className="p-4 text-xs font-bold text-slate-500 uppercase">Produto</th><th className="p-4 text-center text-xs font-bold text-slate-500 uppercase">Estoque Sistema</th><th className="p-4 text-right text-xs font-bold text-slate-500 uppercase">Quantidade Física</th></tr></thead>
                    <tbody className="divide-y divide-border">{products.map(p => (
                      <tr key={p.id} className="hover:bg-slate-50/50">
                        <td className="p-4 font-bold text-slate-700">{p.nome}</td>
                        <td className="p-4 text-center font-medium text-slate-400">{p.estoque_atual}</td>
                        <td className="p-4 text-right"><input type="number" className="input w-32 text-center ml-auto" placeholder="0" onChange={e => setAuditCounts(prev => ({...prev, [p.id]: Number(e.target.value)}))} /></td>
                      </tr>
                    ))}</tbody>
                  </table></div>
                </motion.div>
              )}
              {(activeTab === 'history_entries' || activeTab === 'history_conferences') && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="card p-12 text-center space-y-4">
                  <History className="w-16 h-16 text-slate-200 mx-auto" />
                  <p className="text-slate-400 font-medium">Os históricos estão sendo processados. Consulte o Dashboard para ver os totais atualizados.</p>
                </motion.div>
              )}
            </AnimatePresence>
          )}
        </div>
      </main>

      {/* Modais com design refinado */}
      <AnimatePresence>{isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="card w-full max-w-lg p-8 shadow-2xl">
            <div className="flex justify-between items-center mb-6"><h3 className="text-xl font-bold text-slate-700">{editingProduct ? 'Editar' : 'Novo'} Produto</h3><button onClick={() => setIsModalOpen(false)}><X /></button></div>
            <form onSubmit={handleSaveProduct} className="space-y-4">
              <div><label className="label">Nome do Produto</label><input name="name" defaultValue={editingProduct?.nome} required className="input" /></div>
              <div className="grid grid-cols-2 gap-4"><div><label className="label">Quantidade Atual</label><input name="quantity" type="number" defaultValue={editingProduct?.estoque_atual} required className="input" /></div><div><label className="label">Preço Venda (R$)</label><input name="price" type="number" step="0.01" defaultValue={editingProduct?.valor_venda} required className="input" /></div></div>
              <div className="flex gap-4 pt-4"><button type="button" onClick={() => setIsModalOpen(false)} className="btn btn-secondary flex-1">Cancelar</button><button type="submit" className="btn btn-primary flex-1">Salvar</button></div>
            </form>
          </motion.div>
        </div>
      )}</AnimatePresence>

      <AnimatePresence>{confirmDialog && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-white p-8 rounded-2xl shadow-2xl max-w-md w-full">
            <h3 className="text-xl font-bold text-slate-800 mb-2">{confirmDialog.title}</h3>
            <p className="text-slate-600 mb-8">{confirmDialog.message}</p>
            <div className="flex gap-4"><button onClick={() => setConfirmDialog(null)} className="btn btn-secondary flex-1">Cancelar</button><button onClick={confirmDialog.onConfirm} className="btn btn-primary bg-danger hover:bg-danger/90 flex-1">Confirmar</button></div>
          </motion.div>
        </div>
      )}</AnimatePresence>

      <AnimatePresence>{notification && (
        <motion.div initial={{ opacity: 0, y: 50 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 50 }} className={`fixed bottom-6 right-6 p-4 rounded-xl border-2 z-[100] shadow-2xl flex items-center gap-3 ${notification.type === 'error' ? 'bg-rose-50 border-rose-200 text-rose-800' : 'bg-emerald-50 border-emerald-200 text-emerald-800'}`}>
          {notification.type === 'error' ? <AlertCircle className="w-5 h-5"/> : <CheckCircle2 className="w-5 h-5"/>}
          <span className="font-bold">{notification.message}</span>
        </motion.div>
      )}</AnimatePresence>
    </div>
  );
}
