
import { LoginForm } from '@/components/auth/login-form';

export default function LoginPage() {
    return (
        <div className="h-screen flex items-center justify-center bg-[#0a0a0a]">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-900/20 via-black to-black pointer-events-none" />
            <div className="z-10 w-full flex justify-center p-4">
                <LoginForm />
            </div>
        </div>
    );
}
