export default function Spinner() {
  return (
    <div className="p-3 sm:p-4 flex flex-col min-h-screen dark:bg-gray-950">
      <div className="flex items-center justify-center flex-1">
        <div className="flex flex-col items-center gap-3 text-gray-400 dark:text-gray-500">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm">Just a moment, loading data...</span>
        </div>
      </div>
    </div>
  );
}
