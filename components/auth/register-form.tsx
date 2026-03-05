'use client';

import { useTransition, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { register } from '@/app/lib/actions';
import Link from 'next/link';
import { Loader2 } from 'lucide-react';
import { PasswordStrength } from './PasswordStrength';

const RegisterSchema = z.object({
    name: z.string().min(1, 'Nome é obrigatório'),
    email: z.string().email('Email inválido'),
    password: z.string().min(6, 'Senha deve ter pelo menos 6 caracteres'),
});

export const RegisterForm = () => {
    const [isPending, startTransition] = useTransition();
    const [error, setError] = useState<string | undefined>('');
    const [success, setSuccess] = useState<string | undefined>('');

    const form = useForm<z.infer<typeof RegisterSchema>>({
        resolver: zodResolver(RegisterSchema),
        defaultValues: {
            name: '',
            email: '',
            password: '',
        },
    });

    const onSubmit = (values: z.infer<typeof RegisterSchema>) => {
        setError('');
        setSuccess('');

        startTransition(() => {
            register(values).then((data) => {
                if (data.error) {
                    setError(data.error);
                } else {
                    setSuccess(data.success);
                }
            });
        });
    };

    return (
        <div className="bg-zinc-900 border border-zinc-800 p-8 rounded-2xl shadow-xl w-full max-w-md">
            <div className="mb-8 text-center">
                <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
                    Criar Conta
                </h1>
                <p className="text-zinc-400 mt-2">Comece a organizar suas tarefas hoje</p>
            </div>

            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <div className="space-y-2">
                    <label className="text-sm font-medium text-zinc-300">Nome</label>
                    <input
                        {...form.register('name')}
                        disabled={isPending}
                        placeholder="Seu nome"
                        className="w-full px-4 py-3 bg-zinc-800/50 border border-zinc-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 text-white placeholder-zinc-500 transition-all"
                    />
                    {form.formState.errors.name && (
                        <p className="text-red-400 text-sm">{form.formState.errors.name.message}</p>
                    )}
                </div>

                <div className="space-y-2">
                    <label className="text-sm font-medium text-zinc-300">Email</label>
                    <input
                        {...form.register('email')}
                        disabled={isPending}
                        type="email"
                        placeholder="seu@email.com"
                        className="w-full px-4 py-3 bg-zinc-800/50 border border-zinc-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 text-white placeholder-zinc-500 transition-all"
                    />
                    {form.formState.errors.email && (
                        <p className="text-red-400 text-sm">{form.formState.errors.email.message}</p>
                    )}
                </div>

                <div className="space-y-2">
                    <label className="text-sm font-medium text-zinc-300">Senha</label>
                    <input
                        {...form.register('password')}
                        disabled={isPending}
                        type="password"
                        placeholder="******"
                        className="w-full px-4 py-3 bg-zinc-800/50 border border-zinc-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 text-white placeholder-zinc-500 transition-all"
                    />
                    <PasswordStrength password={form.watch("password")} />
                    {form.formState.errors.password && (
                        <p className="text-red-400 text-sm">{form.formState.errors.password.message}</p>
                    )}
                </div>

                {error && (
                    <div className="bg-red-500/10 text-red-400 p-3 rounded-xl text-sm border border-red-500/20">
                        {error}
                    </div>
                )}

                {success && (
                    <div className="bg-emerald-500/10 text-emerald-400 p-3 rounded-xl text-sm border border-emerald-500/20">
                        {success}
                    </div>
                )}

                <button
                    type="submit"
                    disabled={isPending}
                    className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-semibold py-3 rounded-xl transition-all shadow-lg hover:shadow-blue-500/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                >
                    {isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : "Criar Conta"}
                </button>
            </form>

            <div className="mt-6 text-center text-sm text-zinc-400">
                Já tem uma conta?{' '}
                <Link href="/login" className="text-blue-400 hover:text-blue-300 transition-colors">
                    Fazer Login
                </Link>
            </div>
        </div>
    );
};
