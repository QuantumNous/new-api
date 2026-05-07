FROM golang:1.23-alpine AS build

WORKDIR /src
COPY . .
RUN go build -o /out/seedance-compat .

FROM alpine:3.20

WORKDIR /app
COPY --from=build /out/seedance-compat /app/seedance-compat

EXPOSE 3001

CMD ["/app/seedance-compat"]
