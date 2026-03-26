import { UserButton, OrganizationSwitcher } from '@clerk/nextjs'

export function Header() {
  return (
    <header className="h-16 border-b border-slate-200 bg-white flex items-center justify-between px-6">
      <div className="flex items-center gap-4">
        <OrganizationSwitcher
          hidePersonal
          afterCreateOrganizationUrl="/onboarding"
          afterSelectOrganizationUrl="/dashboard"
        />
      </div>
      <div className="flex items-center gap-3">
        <UserButton afterSignOutUrl="/" />
      </div>
    </header>
  )
}
