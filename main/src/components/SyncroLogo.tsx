type SyncroLogoProps = {
  className?: string;
};

export const SyncroLogo = ({ className }: SyncroLogoProps) => {
  return (
    <img
      src="/syncrologo.png"
      alt="Syncro logo"
      className={className}
      draggable={false}
    />
  );
};
