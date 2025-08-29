psql -d template1 -c "CREATE USER \"postnify-clive-user\" WITH PASSWORD 'poPassNewLvi334' CREATEDB SUPERUSER;"

# If that works, create the database
psql -d template1 -c "CREATE DATABASE \"postnify-db-clive\" OWNER \"postnify-clive-user\";"



 docker exec -it postiz-postgres-xw4sssc4wo8w4g0g88w0804s-194855278962 bash


docker exec postiz-postgres-xw4sssc4wo8w4g0g88w0804s-194855278962 pg_dump -U postnify-clive-user postnify-db-clive > backup.sql