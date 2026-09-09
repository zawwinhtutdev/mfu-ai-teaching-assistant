-- Add email domain validation function
CREATE OR REPLACE FUNCTION validate_university_email()
RETURNS TRIGGER AS $$
BEGIN
  -- Check if email ends with mfu.ac.th (accepts both @lamduan.mfu.ac.th and @mfu.ac.th)
  IF NEW.email NOT LIKE '%mfu.ac.th' THEN
    RAISE EXCEPTION 'Only Mae Fah Luang University email addresses (ending with mfu.ac.th) are allowed';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to validate email on user creation
DROP TRIGGER IF EXISTS validate_email_domain ON auth.users;
CREATE TRIGGER validate_email_domain
  BEFORE INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION validate_university_email();

-- Add comment
COMMENT ON FUNCTION validate_university_email() IS 'Validates that user email belongs to Mae Fah Luang University domain';
