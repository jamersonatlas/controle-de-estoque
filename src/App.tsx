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
      showNotification('Sucesso!', 'success');
    } catch (e) { showNotification('Erro ao salvar.', 'error'); }
  };

  const handleDeleteProduct = async (id: string) => {
    setConfirmDialog({
      title: 'Excluir?',
      message: 'Isso apagará o produto.',
      onConfirm: async () => {
        setConfirmDialog(null);
        await deleteDoc(doc(db, 'produtos', id));
        fetchData();
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
    const batch = writeBatch(db);
    batch.set(doc(collection(db, 'entradas_estoque')), { produto_id: p_id, quantidade_entrada: qtd, data_entrada: formData.get('date'), created_at: new Date().toISOString() });
    batch.update(doc(db, 'produtos', p_id), { estoque_atual: p.estoque_atual + qtd });
    await batch.commit();
    fetchData();
    setActiveTab('history_entries');
  };

  const handleFinishAudit = async () => {
    setConfirmDialog({
      title: 'Finalizar?',
      message: 'Atualizar estoque?',
      onConfirm: async () => {
        setConfirmDialog(null);
        setLoading(true);
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
        setLoading(false);
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
            <div className="w-16 h-16 bg-sidebar rounded-2xl flex items-center justify-center mx-auto mb-4">
              <TrendingUp className="text-white w-10 h-10" />
            </div>
            <h1 className="text-3xl font-bold text-slate-800">EstoqueApp</h1>
            <p className="text-slate-500 font-medium">Acesse com qualquer login e senha</p>
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
                Entrar <ArrowRight className="w-5 h-5 ml-2" />
              </button>
            </form>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-bg overflow-hidden">
      <aside className="w-64 bg-sidebar hidden lg:flex flex-col">
        <div className="p-6 flex items-center gap-3">
          <div className="w-10 h-10 bg-warning rounded-lg flex items-center justify-center"><TrendingUp className="text-white w-6 h-6" /></div>
          <div><h1 className="font-bold text-white">EstoqueApp</h1></div>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1">
          <button onClick={() => setActiveTab('dashboard')} className={`sidebar-item ${activeTab === 'dashboard' ? 'sidebar-item-active' : ''}`}><LayoutDashboard className="w-5 h-5" /> Dashboard</button>
          <button onClick={() => setActiveTab('products')} className={`sidebar-item ${activeTab === 'products' ? 'sidebar-item-active' : ''}`}><Package className="w-5 h-5" /> Produtos</button>
          <button onClick={() => setActiveTab('entry')} className={`sidebar-item ${activeTab === 'entry' ? 'sidebar-item-active' : ''}`}><ArrowDownLeft className="w-5 h-5" /> Entrada</button>
          <button onClick={() => setActiveTab('conference')} className={`sidebar-item ${activeTab === 'conference' ? 'sidebar-item-active' : ''}`}><ClipboardCheck className="w-5 h-5" /> Conferência</button>
        </nav>
        <div className="p-4 border-t border-slate-700"><button onClick={handleLogout} className="sidebar-item text-slate-400"><LogOut className="w-5 h-5" /> Sair</button></div>
      </aside>
      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="h-16 border-b bg-surface flex items-center px-8 justify-between">
          <h2 className="text-lg font-semibold text-slate-700 capitalize">{activeTab}</h2>
          <button onClick={() => setIsMobileMenuOpen(true)} className="lg:hidden"><Menu/></button>
        </header>
        <div className="flex-1 overflow-y-auto p-8">
          {loading ? <div className="flex items-center justify-center h-full"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-sidebar"></div></div> : (
            <div className="space-y-8">
              {activeTab === 'dashboard' && (
                <div className="space-y-8">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="card p-6 flex items-center gap-4"><Package className="text-blue-600"/><div><p className="text-xs text-slate-400 font-bold">PRODUTOS</p><p className="text-2xl font-bold">{products.length}</p></div></div>
                    <div className="card p-6 flex items-center gap-4"><Box className="text-cyan-600"/><div><p className="text-xs text-slate-400 font-bold">ESTOQUE</p><p className="text-2xl font-bold">{stats.totalItems}</p></div></div>
                    <div className="card p-6 flex items-center gap-4"><DollarSign className="text-green-600"/><div><p className="text-xs text-slate-400 font-bold">VALOR TOTAL</p><p className="text-2xl font-bold">R$ {stats.totalValue.toLocaleString('pt-BR')}</p></div></div>
                  </div>
                  <div className="card"><div className="p-6 border-b font-bold">Tabela de Estoque</div>
                    <table className="w-full">
                      <thead><tr className="bg-slate-50"><th className="p-4 text-left">Produto</th><th className="p-4">Qtd</th><th className="p-4 text-right">Valor</th></tr></thead>
                      <tbody>{products.map(p => (
                        <tr key={p.id} className="border-t">
                          <td className="p-4">{p.nome}</td>
                          <td className="p-4 text-center font-bold">{p.estoque_atual}</td>
                          <td className="p-4 text-right">R$ {(p.estoque_atual * p.valor_venda).toLocaleString('pt-BR')}</td>
                        </tr>
                      ))}</tbody>
                    </table>
                  </div>
                </div>
              )}
              {activeTab === 'products' && (
                <div className="space-y-6">
                  <div className="flex justify-between"><input className="input w-64" placeholder="Buscar..." onChange={e => setSearchTerm(e.target.value)}/><button onClick={() => { setEditingProduct(null); setIsModalOpen(true); }} className="btn btn-primary">Novo</button></div>
                  <div className="card">
                    {products.filter(p => p.nome.toLowerCase().includes(searchTerm.toLowerCase())).map(p => (
                      <div key={p.id} className="p-4 border-b flex justify-between">
                        <span>{p.nome}</span>
                        <div className="flex gap-2"><button onClick={() => { setEditingProduct(p); setIsModalOpen(true); }} className="p-2 bg-slate-100 rounded"><Edit2 className="w-4"/></button><button onClick={() => handleDeleteProduct(p.id)} className="p-2 bg-red-50 text-red-600 rounded"><Trash2 className="w-4"/></button></div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {activeTab === 'entry' && (
                <div className="flex justify-center"><div className="card w-full max-w-lg p-8">
                  <form onSubmit={handleRegisterEntry} className="space-y-4">
                    <select name="productId" required className="input"><option value="">Produto</option>{products.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}</select>
                    <input name="quantity" type="number" placeholder="Quantidade" required className="input"/>
                    <input name="date" type="date" defaultValue={new Date().toISOString().split('T')[0]} className="input"/>
                    <button className="btn btn-primary w-full">Salvar</button>
                  </form>
                </div></div>
              )}
              {activeTab === 'conference' && (
                <div className="space-y-6">
                  <div className="flex justify-between font-bold"><span>Contagem Física</span><button onClick={handleFinishAudit} className="btn btn-primary">Finalizar</button></div>
                  <div className="card">{products.map(p => (
                    <div key={p.id} className="p-4 border-b flex justify-between items-center">
                      <span>{p.nome}</span>
                      <input type="number" className="input w-24" placeholder="Contado" onChange={e => setAuditCounts(prev => ({...prev, [p.id]: Number(e.target.value)}))}/>
                    </div>
                  ))}</div>
                </div>
              )}
            </div>
          )}
        </div>
      </main>
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="card w-full max-w-md p-8">
            <h3 className="text-xl font-bold mb-6">Produto</h3>
            <form onSubmit={handleSaveProduct} className="space-y-4">
              <input name="name" defaultValue={editingProduct?.nome} placeholder="Nome" required className="input"/>
              <input name="quantity" type="number" defaultValue={editingProduct?.estoque_atual} placeholder="Qtd" required className="input"/>
              <input name="price" type="number" step="0.01" defaultValue={editingProduct?.valor_venda} placeholder="Preço" required className="input"/>
              <div className="flex gap-2"><button type="button" onClick={() => setIsModalOpen(false)} className="btn btn-secondary flex-1">Cancelar</button><button type="submit" className="btn btn-primary flex-1">Salvar</button></div>
            </form>
          </div>
        </div>
      )}
      {confirmDialog && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60">
          <div className="bg-white p-6 rounded-xl max-w-sm w-full">
            <h3 className="font-bold mb-4">{confirmDialog.message}</h3>
            <div className="flex gap-3"><button onClick={() => setConfirmDialog(null)} className="btn btn-secondary flex-1">Não</button><button onClick={confirmDialog.onConfirm} className="btn btn-primary bg-danger flex-1">Sim</button></div>
          </div>
        </div>
      )}
    </div>
  );
}
