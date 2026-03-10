'use client';

import { useState, useEffect } from 'react';
import { Users, UserPlus, Trash2, Crown, User2, Mail, Loader2 } from 'lucide-react';

interface Member {
    id: string;
    name: string | null;
    email: string | null;
    image: string | null;
    role: string;
}

import { WorkspaceSwitcher } from '@/components/WorkspaceSwitcher';

export default function EquipePage() {
    const [members, setMembers] = useState<Member[]>([]);
    const [loading, setLoading] = useState(true);
    const [inviteEmail, setInviteEmail] = useState('');
    const [inviteRole, setInviteRole] = useState('EMPLOYEE');
    const [inviting, setInviting] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    const fetchMembers = async () => {
        setLoading(true);
        const res = await fetch('/api/team');
        const data = await res.json();
        setMembers(Array.isArray(data) ? data : []);
        setLoading(false);
    };

    useEffect(() => { fetchMembers(); }, []);

    const handleInvite = async (e: React.FormEvent) => {
        e.preventDefault();
        setInviting(true);
        setMessage(null);
        try {
            const res = await fetch('/api/team', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: inviteEmail, memberRole: inviteRole }),
            });
            const data = await res.json();
            if (res.ok) {
                setMessage({ type: 'success', text: `${data.name || data.email} adicionado(a) à equipe!` });
                setInviteEmail('');
                fetchMembers();
            } else {
                setMessage({ type: 'error', text: data.error || 'Erro ao adicionar membro' });
            }
        } catch {
            setMessage({ type: 'error', text: 'Erro de conexão' });
        } finally {
            setInviting(false);
        }
    };

    const handleRemove = async (userId: string, name: string | null) => {
        if (!confirm(`Remover ${name || 'membro'} da equipe?`)) return;
        const res = await fetch(`/api/team?userId=${userId}`, { method: 'DELETE' });
        if (res.ok) {
            setMessage({ type: 'success', text: 'Membro removido.' });
            fetchMembers();
        } else {
            const data = await res.json();
            setMessage({ type: 'error', text: data.error || 'Erro ao remover' });
        }
    };

    const handleChangeRole = async (userId: string, newRole: string) => {
        try {
            const res = await fetch(`/api/team`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId, role: newRole }),
            });
            if (res.ok) {
                setMessage({ type: 'success', text: 'Função atualizada.' });
                fetchMembers();
            } else {
                const data = await res.json();
                setMessage({ type: 'error', text: data.error || 'Erro ao atualizar função' });
            }
        } catch {
            setMessage({ type: 'error', text: 'Erro de conexão' });
        }
    };

    return (
        <div className="max-w-4xl mx-auto flex flex-col gap-8 pb-10">
            {/* Header / Workspace Switcher area */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent flex items-center gap-3">
                        <Users size={28} className="text-blue-400" />
                        Gerenciar Equipe
                    </h1>
                    <p className="text-muted-foreground mt-1 text-sm">
                        Adicione e gerencie os membros do seu workspace.
                    </p>
                </div>
                
                <div className="w-full md:w-64">
                    <WorkspaceSwitcher />
                </div>
            </div>

            {/* Invite Form */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 mb-8">
                <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                    <UserPlus size={20} className="text-purple-400" />
                    Adicionar Membro
                </h2>
                <form onSubmit={handleInvite} className="flex flex-col sm:flex-row gap-3">
                    <input
                        type="email"
                        value={inviteEmail}
                        onChange={(e) => setInviteEmail(e.target.value)}
                        placeholder="email@exemplo.com"
                        required
                        className="flex-1 px-4 py-2.5 bg-zinc-800 border border-zinc-700 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 text-sm"
                    />
                    <select
                        value={inviteRole}
                        onChange={(e) => setInviteRole(e.target.value)}
                        className="px-4 py-2.5 bg-zinc-800 border border-zinc-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 text-sm"
                    >
                        <option value="EMPLOYEE">Funcionário</option>
                        <option value="MANAGER">Gestor</option>
                    </select>
                    <button
                        type="submit"
                        disabled={inviting}
                        className="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-medium rounded-xl transition-all text-sm flex items-center gap-2 disabled:opacity-50"
                    >
                        {inviting ? <Loader2 size={16} className="animate-spin" /> : <UserPlus size={16} />}
                        Adicionar
                    </button>
                </form>
                {message && (
                    <p className={`mt-3 text-sm ${message.type === 'success' ? 'text-emerald-400' : 'text-red-400'}`}>
                        {message.text}
                    </p>
                )}
                <p className="text-xs text-zinc-500 mt-2">
                    O usuário precisa ter uma conta cadastrada no sistema.
                </p>
            </div>

            {/* Members List */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
                <div className="px-6 py-4 border-b border-zinc-800">
                    <h2 className="text-lg font-semibold text-white">Membros ({members.length})</h2>
                </div>
                {loading ? (
                    <div className="flex items-center justify-center py-12 text-zinc-500">
                        <Loader2 className="animate-spin mr-2" size={20} /> Carregando...
                    </div>
                ) : members.length === 0 ? (
                    <div className="py-12 text-center text-zinc-500 text-sm">Nenhum membro encontrado.</div>
                ) : (
                    <ul className="divide-y divide-zinc-800">
                        {members.map((member) => (
                            <li key={member.id} className="flex items-center justify-between px-6 py-4 hover:bg-zinc-800/50 transition-colors">
                                <div className="flex items-center gap-3">
                                    {member.image ? (
                                        <img src={member.image} alt={member.name || ''} className="w-9 h-9 rounded-full object-cover" />
                                    ) : (
                                        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center text-white font-bold text-sm shrink-0">
                                            {(member.name || member.email || '?')[0].toUpperCase()}
                                        </div>
                                    )}
                                    <div className="min-w-0">
                                        <p className="text-sm font-medium text-white truncate">{member.name || 'Sem nome'}</p>
                                        <p className="text-xs text-zinc-400 flex items-center gap-1 truncate">
                                            <Mail size={11} className="shrink-0" />
                                            <span className="truncate">{member.email}</span>
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 sm:gap-3">
                                    <select
                                        value={member.role}
                                        onChange={(e) => handleChangeRole(member.id, e.target.value)}
                                        className={`text-xs font-medium px-2 py-1 rounded-full outline-none appearance-none cursor-pointer pr-6 relative bg-no-repeat bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20width%3D%2210%22%20height%3D%225%22%20viewBox%3D%220%200%2010%205%22%20fill%3D%22none%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Cpath%20d%3D%22M5%205L0%200H10L5%205Z%22%20fill%3D%22currentColor%22%2F%3E%3C%2Fsvg%3E')] bg-[position:calc(100%-8px)_center] ${
                                            member.role === 'MANAGER' || member.role === 'ADMIN'
                                                ? 'bg-amber-500/15 text-amber-400 border border-amber-500/20'
                                                : 'bg-blue-500/15 text-blue-400 border border-blue-500/20'
                                        }`}
                                    >
                                        <option value="MANAGER" className="bg-zinc-800 text-white">Gestor</option>
                                        <option value="EMPLOYEE" className="bg-zinc-800 text-white">Funcionário</option>
                                    </select>

                                    <button
                                        onClick={() => handleRemove(member.id, member.name)}
                                        className="text-zinc-600 hover:text-red-400 transition-colors p-1.5 hover:bg-red-500/10 rounded-lg shrink-0"
                                        title="Remover da equipe"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </div>
    );
}
