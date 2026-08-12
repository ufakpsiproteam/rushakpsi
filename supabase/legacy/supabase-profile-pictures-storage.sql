-- Create storage bucket for profile pictures
INSERT INTO storage.buckets (id, name, public)
VALUES ('profile-pictures', 'profile-pictures', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for profile-pictures bucket
-- Allow authenticated users to upload their own profile picture
CREATE POLICY "Users can upload their own profile picture"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'profile-pictures' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Allow anyone to view profile pictures (public bucket)
CREATE POLICY "Anyone can view profile pictures"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'profile-pictures');

-- Allow users to update their own profile picture
CREATE POLICY "Users can update their own profile picture"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'profile-pictures' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Allow users to delete their own profile picture
CREATE POLICY "Users can delete their own profile picture"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'profile-pictures' AND auth.uid()::text = (storage.foldername(name))[1]);
