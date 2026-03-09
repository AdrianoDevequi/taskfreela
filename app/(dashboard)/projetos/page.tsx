'use client';

import { useState, useEffect } from 'react';
import { Briefcase, Plus, Search, Loader2, Trash2, Edit2 } from 'lucide-react';

interface Project {
    id: string;
    name: string;
    description: string | null;
    status: string;
    createdAt: string;
    _count?: { tasks: number };
}

export default function ProjetosPage() {
    const [projects, setProjects] = useState<Project[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    
    // Modal state
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [saving, setSaving] = useState(false);
    const [editingProject, setEditingProject] = useState<Project | null>(null);
    const [formData, setFormData] = useState({ name: '', description: '', status: 'ACTIVE' });

    const fetchProjects = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/projects');
            const data = await res.json();
            setProjects(Array.isArray(data) ? data : []);
        } catch (error) {
            console.error("Error fetching projects", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchProjects(); }, []);

    const handleOpenModal = (project?: Project) => {
        if (project) {
            setEditingProject(project);
            setFormData({ name: project.name, description: project.description || '', status: project.status });
        } else {
            setEditingProject(null);
            setFormData({ name: '', description: '', status: 'ACTIVE' });
        }
        setIsModalOpen(true);
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        const method = editingProject ? 'PUT' : 'POST';
        const body = editingProject ? { ...formData, id: editingProject.id } : formData;

        try {
            const res = await fetch('/api/projects', {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            if (res.ok) {
                fetchProjects();
                setIsModalOpen(false);
            }
        } catch (error) {
            console.error("Error saving project", error);
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id: string, name: string) => {
        if (!confirm(`Excluir o projeto "${name}"? Essa ação não pode ser desfeita e todas as tarefas vinculadas ficarão sem projeto.`)) return;
        
        try {
            const res = await fetch(`/api/projects?id=${id}`, { method: 'DELETE' });
            if (res.ok) {
                setProjects(projects.filter(p => p.id !== id));
            }
        } catch (error) {
            console.error("Error deleting project", error);
        }
    };

    const filteredProjects = projects.filter(p => 
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
        (p.description && p.description.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    return (
        <div className="max-w-6xl mx-auto h-full flex flex-col">
            {/* Header */}
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-8">
                <div>
                    <h1 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent flex items-center gap-3">
                        <Briefcase size={28} className="text-blue-400" />
                        Projetos
                    </h1>
                    <p className="text-muted-foreground mt-1 text-sm">
                        Agrupe suas tarefas e acompanhe o progresso de cada entrega.
                    </p>
                </div>
                <button
                    onClick={() => handleOpenModal()}
                    className="w-full md:w-auto bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white px-5 py-2.5 rounded-xl font-medium flex items-center justify-center gap-2 transition-all shadow-lg hover:shadow-blue-500/25 active:scale-95 text-sm"
                >
                    <Plus size={20} />
                    <span>Novo Projeto</span>
                </button>
            </div>

            {/* List/Grid Container */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden flex-1 flex flex-col">
                {/* Toolbar */}
                <div className="p-4 border-b border-zinc-800 flex items-center gap-4 bg-zinc-900/50">
                    <div className="relative flex-1 max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
                        <input
                            type="text"
                            placeholder="Buscar projetos..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 bg-zinc-800 border border-zinc-700 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 text-sm"
                        />
                    </div>
                </div>

                {/* Content */}
                <div className="p-6 flex-1 overflow-y-auto">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center h-40 text-zinc-500 gap-3">
                            <Loader2 className="animate-spin" size={24} />
                            <p className="text-sm">Carregando projetos...</p>
                        </div>
                    ) : filteredProjects.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-40 text-zinc-500 gap-3">
                            <Briefcase size={32} className="opacity-20" />
                            <p className="text-sm">Nenhum projeto encontrado.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {filteredProjects.map(project => (
                                <div key={project.id} className="bg-zinc-800/50 border border-zinc-700/50 rounded-xl p-5 hover:border-zinc-600 transition-colors group relative flex flex-col">
                                    <div className="flex justify-between items-start mb-3 gap-4">
                                        <h3 className="font-semibold text-lg text-white line-clamp-1 flex-1" title={project.name}>
                                            {project.name}
                                        </h3>
                                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase shrink-0 ${
                                            project.status === 'ACTIVE' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 
                                            project.status === 'COMPLETED' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' : 
                                            'bg-zinc-500/10 text-zinc-400 border border-zinc-500/20'
                                        }`}>
                                            {project.status === 'ACTIVE' ? 'Ativo' : project.status === 'COMPLETED' ? 'Concluído' : 'Arquivado'}
                                        </span>
                                    </div>
                                    <p className="text-sm text-zinc-400 mb-6 line-clamp-2 flex-1">
                                        {project.description || 'Sem descrição.'}
                                    </p>
                                    
                                    <div className="flex items-center justify-between border-t border-zinc-700/50 pt-4 mt-auto">
                                        <div className="text-xs font-medium text-zinc-300 bg-zinc-800 px-3 py-1.5 rounded-lg border border-zinc-700">
                                            {project._count?.tasks || 0} Tarefas
                                        </div>
                                        <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button 
                                                onClick={() => handleOpenModal(project)}
                                                className="p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-700 rounded-lg transition-colors"
                                                title="Editar Projeto"
                                            >
                                                <Edit2 size={16} />
                                            </button>
                                            <button 
                                                onClick={() => handleDelete(project.id, project.name)}
                                                className="p-1.5 text-zinc-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                                                title="Excluir Projeto"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Create/Edit Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => !saving && setIsModalOpen(false)} />
                    <div className="relative bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl w-full max-w-md animate-in zoom-in-95 duration-200">
                        <form onSubmit={handleSave} className="flex flex-col h-full">
                            <div className="p-6 border-b border-zinc-800">
                                <h2 className="text-xl font-bold text-white">
                                    {editingProject ? 'Editar Projeto' : 'Novo Projeto'}
                                </h2>
                            </div>
                            <div className="p-6 space-y-4 flex-1">
                                <div className="space-y-2">
                                    <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider">NOME DO PROJETO</label>
                                    <input
                                        type="text"
                                        required
                                        autoFocus
                                        value={formData.name}
                                        onChange={e => setFormData({ ...formData, name: e.target.value })}
                                        className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-xl text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all text-sm"
                                        placeholder="Ex: Refazer Site Master Sites"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider">DESCRIÇÃO (Opcional)</label>
                                    <textarea
                                        value={formData.description}
                                        onChange={e => setFormData({ ...formData, description: e.target.value })}
                                        className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-xl text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all text-sm resize-none h-24"
                                        placeholder="Detalhes ou briefing do projeto..."
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider">STATUS</label>
                                    <select
                                        value={formData.status}
                                        onChange={e => setFormData({ ...formData, status: e.target.value })}
                                        className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-xl text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all text-sm appearance-none"
                                    >
                                        <option value="ACTIVE"> Ativo (Em andamento)</option>
                                        <option value="COMPLETED"> Concluído</option>
                                        <option value="ARCHIVED"> Arquivado</option>
                                    </select>
                                </div>
                            </div>
                            <div className="p-6 border-t border-zinc-800 bg-zinc-900/50 flex justify-end gap-3 rounded-b-2xl">
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    disabled={saving}
                                    className="px-5 py-2.5 rounded-xl text-sm font-medium text-zinc-300 hover:text-white hover:bg-zinc-800 transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={saving}
                                    className="px-5 py-2.5 rounded-xl text-sm font-medium text-white bg-blue-600 hover:bg-blue-500 disabled:opacity-50 transition-colors flex items-center gap-2"
                                >
                                    {saving && <Loader2 size={16} className="animate-spin" />}
                                    {saving ? 'Salvando...' : 'Salvar Projeto'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
