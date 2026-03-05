'use client';

import { useState, useTransition } from "react";
import { updateProfile } from "@/app/lib/actions";
import { useRouter } from "next/navigation";
import { PasswordStrength } from "@/components/auth/PasswordStrength";

interface ProfileFormProps {
    user: {
        name?: string | null;
        email?: string | null;
        image?: string | null;
    }
}

export function ProfileForm({ user }: ProfileFormProps) {
    const [isPending, startTransition] = useTransition();
    const [error, setError] = useState<string | undefined>("");
    const [success, setSuccess] = useState<string | undefined>("");
    const router = useRouter();

    const [formData, setFormData] = useState({
        name: user.name || "",
        email: user.email || "",
        password: "",
    });

    const onSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setSuccess("");

        startTransition(() => {
            updateProfile(formData)
                .then((data) => {
                    if (data.error) {
                        setError(data.error);
                    }
                    if (data.success) {
                        setSuccess(data.success);
                        router.refresh();
                    }
                })
                .catch(() => setError("Something went wrong!"));
        });
    };

    return (
        <form onSubmit={onSubmit} className="space-y-6 max-w-xl bg-gray-900 p-8 rounded-xl border border-gray-800">

            <div className="space-y-2">
                <label className="text-sm font-medium text-gray-200">Nome</label>
                <input
                    type="text"
                    disabled={isPending}
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full p-3 rounded-lg bg-gray-800 border border-gray-700 text-white focus:ring-2 focus:ring-purple-500 outline-none transition"
                />
            </div>

            <div className="space-y-2">
                <label className="text-sm font-medium text-gray-200">Email</label>
                <input
                    type="email"
                    disabled={isPending}
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full p-3 rounded-lg bg-gray-800 border border-gray-700 text-white focus:ring-2 focus:ring-purple-500 outline-none transition"
                />
            </div>

            <div className="space-y-2">
                <label className="text-sm font-medium text-gray-200">Nova Senha</label>
                <input
                    type="password"
                    disabled={isPending}
                    placeholder="Deixe em branco para não alterar"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="w-full p-3 rounded-lg bg-gray-800 border border-gray-700 text-white focus:ring-2 focus:ring-purple-500 outline-none transition"
                />
                <PasswordStrength password={formData.password} />
            </div>

            {error && (
                <div className="bg-red-500/15 p-3 rounded-md flex items-center gap-x-2 text-sm text-red-500">
                    ⚠️ {error}
                </div>
            )}

            {success && (
                <div className="bg-emerald-500/15 p-3 rounded-md flex items-center gap-x-2 text-sm text-emerald-500">
                    ✅ {success}
                </div>
            )}

            <button
                type="submit"
                disabled={isPending}
                className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 rounded-lg transition disabled:opacity-50"
            >
                {isPending ? "Salvando..." : "Salvar Alterações"}
            </button>
        </form>
    );
}
