type SyncroLogoProps = {
  className?: string;
};

export const SyncroLogo = ({ className }: SyncroLogoProps) => {
  return (
    <img
      src="/logo_syncro.png"
      alt="Syncro logo"
      className={className}
      draggable={false}
    />
  );
};
