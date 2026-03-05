import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { ProfileForm } from "./ProfileForm";

export default async function ProfilePage() {
    const session = await auth();

    if (!session?.user) {
        redirect("/login");
    }

    return (
        <div className="p-8 max-w-4xl">
            <h1 className="text-3xl font-bold mb-2 text-white">Meu Perfil</h1>
            <p className="text-gray-400 mb-8">Gerencie suas informações pessoais e de acesso.</p>

            <ProfileForm user={session.user} />
        </div>
    );
}
