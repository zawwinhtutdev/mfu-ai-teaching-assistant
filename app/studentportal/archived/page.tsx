export default function ArchivedPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-normal text-gray-900 dark:text-gray-100 mb-1">
          Archived classes
        </h1>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Classes you've archived
        </p>
      </div>
      <div className="text-center py-12">
        <p className="text-gray-600 dark:text-gray-400">
          No archived classes
        </p>
      </div>
    </div>
  )
}

