# Build stage
FROM golang:1.22-alpine AS builder
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -o server ./cmd/main.go

# Run stage - includes Redis
FROM alpine:latest
RUN apk --no-cache add ca-certificates redis

WORKDIR /root/
COPY --from=builder /app/server .
COPY start.sh .
RUN chmod +x start.sh

EXPOSE 8080

CMD ["./start.sh"]
