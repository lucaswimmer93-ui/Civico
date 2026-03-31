import { useEffect, useState } from "react";
import {
  getGemeindeVereine,
  getOrCreateVereinGemeindeThread,
} from "../../services/messages";
import MessageThreadView from "./MessageThreadView";

export default function MeineVereinePanel() {
  const [vereine, setVereine] = useState([]);
  const [filteredVereine, setFilteredVereine] = useState([]);
  const [selectedVerein, setSelectedVerein] = useState(null);
  const [thread, setThread] = useState(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingThread, setLoadingThread] = useState(false);
  const [error, setError] = useState("");

  // Vereine laden
  useEffect(() => {
    async function load() {
      setLoading(true);
      setError("");

      try {
        const data = await getGemeindeVereine();
        setVereine(data);
        setFilteredVereine(data);
      } catch (err) {
        console.error(err);
        setError(err?.message || "Vereine konnten nicht geladen werden.");
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  // Suche
  useEffect(() => {
    const lower = search.toLowerCase();

    const filtered = vereine.filter((v) =>
      v.name?.toLowerCase().includes(lower)
    );

    setFilteredVereine(filtered);
  }, [search, vereine]);

  // Thread öffnen
  async function openThread(verein) {
    setSelectedVerein(verein);
    setLoadingThread(true);

    try {
      const threadData = await getOrCreateVereinGemeindeThread(verein.id);
      setThread(threadData);
    } catch (err) {
      console.error(err);
      setError(err?.message || "Thread konnte nicht geöffnet werden.");
    } finally {
      setLoadingThread(false);
    }
  }

  if (loading) {
    return <div className="text-sm text-gray-500">Vereine werden geladen …</div>;
  }

  if (error) {
    return <div className="text-sm text-red-600">{error}</div>;
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      
      {/* LINK: Vereinsliste */}
      <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-xl font-semibold">Meine Vereine</h2>

        {/* Suche */}
        <input
          type="text"
          placeholder="Verein suchen …"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="mb-4 w-full rounded-xl border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-500"
        />

        <div className="space-y-2 max-h-[400px] overflow-y-auto">
          {filteredVereine.length === 0 ? (
            <div className="text-sm text-gray-500">
              Keine Vereine gefunden.
            </div>
          ) : (
            filteredVereine.map((verein) => (
              <div
                key={verein.id}
                className="flex items-center justify-between rounded-xl border border-gray-100 px-3 py-2"
              >
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    {verein.name}
                  </p>
                  <p className="text-xs text-gray-500">{verein.email}</p>
                </div>

                <button
                  onClick={() => openThread(verein)}
                  className="rounded-lg bg-gray-900 px-3 py-1.5 text-xs text-white hover:bg-black"
                >
                  Nachrichten
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* RECHTS: Nachrichten */}
      <div>
        {loadingThread ? (
          <div className="text-sm text-gray-500">
            Nachrichten werden geladen …
          </div>
        ) : selectedVerein && thread ? (
          <MessageThreadView
            threadId={thread.id}
            title={`Nachrichten mit ${selectedVerein.name}`}
          />
        ) : (
          <div className="rounded-2xl border border-gray-200 bg-white p-4 text-sm text-gray-500 shadow-sm">
            Wähle einen Verein aus, um Nachrichten zu sehen.
          </div>
        )}
      </div>
    </div>
  );
}