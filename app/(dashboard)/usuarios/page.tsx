import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ShieldAlert, User as UserIcon } from "lucide-react";
import Image from "next/image";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
    const session = await auth();

    // Ensure user is logged in
    if (!session?.user?.id) {
        redirect("/login");
    }

    // Double check Super Admin status
    const currentUser = await (prisma.user as any).findUnique({
        where: { id: session.user.id },
        select: { isSuperAdmin: true }
    });

    if (!currentUser?.isSuperAdmin) {
        redirect("/dashboard"); // Kick non-admins out
    }

    // Fetch all users with their sessions to calculate "Last Access"
    const allUsers = await prisma.user.findMany({
        include: {
            session: {
                orderBy: { expires: 'desc' },
                take: 1, // Get the most recent session
            }
        },
        orderBy: {
            createdAt: 'desc'
        }
    });

    return (
        <div className="max-w-6xl mx-auto py-8">
            <div className="mb-8 flex items-center gap-3">
                <div className="p-3 bg-purple-500/10 text-purple-500 rounded-xl">
                    <ShieldAlert size={28} />
                </div>
                <div>
                    <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-400 to-blue-500 bg-clip-text text-transparent">
                        Painel de Usuários Activos
                    </h1>
                    <p className="text-muted-foreground">Visão geral de todos os membros cadastrados na plataforma TaskFreela.</p>
                </div>
            </div>

            <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="text-xs text-muted-foreground uppercase bg-muted/50 border-b border-border">
                            <tr>
                                <th scope="col" className="px-6 py-4 font-medium">Usuário</th>
                                <th scope="col" className="px-6 py-4 font-medium">Email</th>
                                <th scope="col" className="px-6 py-4 font-medium">Data de Cadastro</th>
                                <th scope="col" className="px-6 py-4 font-medium">Último Acesso (Sessão)</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {(allUsers as any[]).map((u) => {
                                // Calculate Last Access from session. If no session, fallback to "Nunca fez login".
                                let lastAccessDisplay = "Sem registro de login";
                                if (u.session && u.session.length > 0) {
                                  // NextAuth sets `expires` 30 days in the future from the last active ping
                                  const lastActiveDate = new Date(u.session[0].expires.getTime() - (30 * 24 * 60 * 60 * 1000));
                                  lastAccessDisplay = format(lastActiveDate, "dd 'de' MMMM 'de' yyyy, 'às' HH:mm", { locale: ptBR });
                                }

                                return (
                                    <tr key={u.id} className="hover:bg-muted/20 transition-colors">
                                        <td className="px-6 py-4 relative">
                                            <div className="flex items-center gap-3">
                                                {u.image ? (
                                                    <Image
                                                        src={u.image}
                                                        alt={u.name || "User"}
                                                        width={32}
                                                        height={32}
                                                        className="rounded-full bg-muted object-cover"
                                                    />
                                                ) : (
                                                    <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                                                        <UserIcon size={16} />
                                                    </div>
                                                )}
                                                <div className="flex flex-col">
                                                    <span className="font-semibold text-foreground flex items-center gap-2">
                                                        {u.name || "Sem Nome"}
                                                        {u.isSuperAdmin && (
                                                            <span className="bg-gradient-to-r from-purple-500/20 to-blue-500/20 text-purple-400 text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider border border-purple-500/30">
                                                                ADM
                                                            </span>
                                                        )}
                                                    </span>
                                                    {u.whatsapp && (
                                                        <span className="text-xs text-muted-foreground">{u.whatsapp}</span>
                                                    )}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-muted-foreground">
                                            {u.email}
                                        </td>
                                        <td className="px-6 py-4 text-muted-foreground">
                                            {format(new Date(u.createdAt), "dd/MM/yyyy", { locale: ptBR })}
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-green-500/10 text-green-500 border border-green-500/20">
                                                {lastAccessDisplay}
                                            </span>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
                {allUsers.length === 0 && (
                    <div className="p-8 text-center text-muted-foreground">
                        Nenhum usuário encontrado.
                    </div>
                )}
            </div>
        </div>
    );
}
