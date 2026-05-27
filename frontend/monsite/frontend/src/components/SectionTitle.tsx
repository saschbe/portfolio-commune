type SectionTitleProps = {
  children: React.ReactNode;
};

export default function SectionTitle({ children }: SectionTitleProps) {
  return (
    <h3
      className="
        text-lg
        md:text-xl
        xl:text-2xl
        uppercase
        tracking-[0.08em]
        leading-tight
        text-balance
      "
    >
      {children}
    </h3>
  );
}
