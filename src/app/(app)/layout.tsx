import { Shell } from "@/components/shell";
import { PortaoAssinatura } from "@/components/portao";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <PortaoAssinatura>
      <Shell>{children}</Shell>
    </PortaoAssinatura>
  );
}
