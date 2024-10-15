import { createSignal, createEffect, Show, onCleanup } from 'solid-js'
import { supabase } from '../lib/supabase'
import { z } from 'zod' // Import zod for request validation
import { createQuery } from '@tanstack/solid-query'
import { useAuth } from '../hooks/useAuth'

// Define a schema for profile data
const ProfileSchema = z.object({
  username: z.string().nullable(),
})

export function UserInfo(props: { session: { user: any } }) {
  const [isDropdownOpen, setIsDropdownOpen] = createSignal(false)
  const [isEditingProfile, setIsEditingProfile] = createSignal(false)
  const [username, setUsername] = createSignal<string | null>(null)
  const [error, setError] = createSignal<string | null>(null)
  let dropdownRef: HTMLDivElement | undefined

  const profileQuery = createQuery(() => ({
    queryKey: ['profile', props.session.user.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select(`username`)
        .eq('id', props.session.user.id)
        .single()

      if (error) throw error

      return ProfileSchema.parse(data)
    },
  }))

  createEffect(() => {
    if (profileQuery.data) {
      setUsername(profileQuery.data.username)
    }
  })

  const handleClickOutside = (event: MouseEvent) => {
    if (dropdownRef && !dropdownRef.contains(event.target as Node)) {
      setIsDropdownOpen(false)
    }
  }

  createEffect(() => {
    if (isDropdownOpen()) {
      document.addEventListener('mousedown', handleClickOutside)
      onCleanup(() => {
        document.removeEventListener('mousedown', handleClickOutside)
      })
    }
  })

  async function updateProfile(e: Event) {
    e.preventDefault()

    try {
      const { user } = props.session

      const updates = {
        id: user.id,
        username: username(),
        updated_at: new Date(),
      }

      const UpdateSchema = ProfileSchema.extend({ 
        id: z.string(), 
        updated_at: z.date() 
      })
      const validatedUpdates = UpdateSchema.parse(updates)

      const { error } = await supabase.from('profiles').upsert(validatedUpdates)

      if (error) throw error
      setIsEditingProfile(false)
    } catch (error: any) {
      console.error('Error updating profile:', error.message)
      setError(error.message)
    }
  }

  const { signOut } = useAuth();

  const handleSignOut = async () => {
    console.log("Starting sign out process");
    try {
      await signOut();
      console.log("Sign out completed");
    } catch (error) {
      console.error("Error during sign out:", error);
    }
  };

  return (
    <div class="relative inline-block text-left z-50" ref={dropdownRef}>
      <button
        onClick={() => setIsDropdownOpen(!isDropdownOpen())}
        class="flex items-center space-x-2 text-white hover:text-blue-300 transition-colors p-2 rounded-md hover:bg-gray-700"
        aria-haspopup="true"
        aria-expanded={isDropdownOpen()}
      >
        <div class="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
          {username()?.[0]?.toUpperCase() || 'U'}
        </div>
        <span class="max-w-[150px] truncate">{username() || props.session.user.email}</span>
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
        </svg>
      </button>

      <Show when={isDropdownOpen()}>
        <div 
          class="origin-top-right absolute right-0 mt-2 w-48 rounded-md shadow-lg bg-gray-800 ring-1 ring-black ring-opacity-5 focus:outline-none"
          role="menu"
          aria-orientation="vertical"
          aria-labelledby="user-menu"
        >
          <div class="py-1" role="none">
            <button
              onClick={() => {
                setIsEditingProfile(true)
                setIsDropdownOpen(false)
              }}
              class="block w-full text-left px-4 py-2 text-sm text-gray-300 hover:bg-gray-700 transition-colors focus:outline-none focus:bg-gray-700"
              role="menuitem"
            >
              Edit Profile
            </button>
            <button
              onClick={handleSignOut}
              class="block w-full text-left px-4 py-2 text-sm text-gray-300 hover:bg-gray-700 transition-colors focus:outline-none focus:bg-gray-700"
              role="menuitem"
            >
              Sign Out
            </button>
          </div>
        </div>
      </Show>

      <Show when={isEditingProfile()}>
        <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div class="bg-gray-800 p-6 rounded-lg shadow-xl w-96">
            <h2 class="text-xl font-bold text-white mb-4">Edit Profile</h2>
            <form onSubmit={updateProfile} class="space-y-4">
              <div>
                <label for="email" class="block text-sm font-medium text-gray-300">Email</label>
                <input id="email" type="text" value={props.session.user.email} disabled
                  class="mt-1 block w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white" />
              </div>
              <div>
                <label for="username" class="block text-sm font-medium text-gray-300">Name</label>
                <input
                  id="username"
                  type="text"
                  value={username() || ''}
                  onChange={(e) => setUsername(e.currentTarget.value || null)}
                  class="mt-1 block w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div class="flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsEditingProfile(false)}
                  class="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  class="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                  disabled={profileQuery.isLoading}
                >
                  {profileQuery.isLoading ? 'Saving...' : 'Save'}
                </button>
              </div>
            </form>
            <Show when={error()}>
              <p class="text-red-500 mt-2">{error()}</p>
            </Show>
          </div>
        </div>
      </Show>
    </div>
  )
}
